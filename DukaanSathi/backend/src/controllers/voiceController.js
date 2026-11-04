import Groq from "groq-sdk";
import { z } from "zod";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const commandSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["SALE", "PAYMENT", "ADD_PRODUCT", "ADD_CUSTOMER", "RESTOCK", "LOW_STOCK_QUERY", "STOCK_QUERY", "CUSTOMER_CREDIT_QUERY", "UNKNOWN"] },
    items: { type: "array", items: { type: "object", additionalProperties: false, properties: { productId: nullableString, productName: { type: "string" }, quantity: { type: "integer" } }, required: ["productId", "productName", "quantity"] } },
    customerId: nullableString,
    customerName: { type: "string" },
    customerPhone: nullableString,
    customerNotes: nullableString,
    cashReceived: nullableNumber,
    amount: nullableNumber,
    productId: nullableString,
    productName: { type: "string" },
    category: nullableString,
    purchasePrice: nullableNumber,
    sellingPrice: nullableNumber,
    quantity: { anyOf: [{ type: "integer" }, { type: "null" }] },
    unit: nullableString,
    minStock: { anyOf: [{ type: "integer" }, { type: "null" }] },
    stockChange: { anyOf: [{ type: "integer" }, { type: "null" }] },
    needsClarification: { type: "boolean" },
    clarificationQuestion: { type: "string" },
    responseText: { type: "string" }
  },
  required: ["intent", "items", "customerId", "customerName", "customerPhone", "customerNotes", "cashReceived", "amount", "productId", "productName", "category", "purchasePrice", "sellingPrice", "quantity", "unit", "minStock", "stockChange", "needsClarification", "clarificationQuestion", "responseText"]
};

const parsedCommandSchema = z.object({
  intent: z.enum(["SALE", "PAYMENT", "ADD_PRODUCT", "ADD_CUSTOMER", "RESTOCK", "LOW_STOCK_QUERY", "STOCK_QUERY", "CUSTOMER_CREDIT_QUERY", "UNKNOWN"]),
  items: z.array(z.object({ productId: z.string().nullable(), productName: z.string(), quantity: z.number().int() })),
  customerId: z.string().nullable(), customerName: z.string(),
  customerPhone: z.string().nullable(), customerNotes: z.string().nullable(),
  cashReceived: z.number().nonnegative().nullable(), amount: z.number().positive().nullable(),
  productId: z.string().nullable(), productName: z.string(), category: z.string().nullable(),
  purchasePrice: z.number().nonnegative().nullable(), sellingPrice: z.number().nonnegative().nullable(),
  quantity: z.number().int().nonnegative().nullable(), unit: z.string().nullable(),
  minStock: z.number().int().nonnegative().nullable(), stockChange: z.number().int().positive().nullable(),
  needsClarification: z.boolean(), clarificationQuestion: z.string(), responseText: z.string()
});

export async function interpretVoiceCommand(req, res) {
  const transcript = String(req.body?.transcript || "").trim();
  if (transcript.length < 2 || transcript.length > 1000) return res.status(400).json({ success: false, message: "Please provide a voice command between 2 and 1000 characters." });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ success: false, message: "Groq is not configured. Add GROQ_API_KEY to backend/.env and restart the server." });

  try {
    const [products, customers] = await Promise.all([
      Product.find({ shop: req.userId }).select("name quantity unit sellingPrice purchasePrice minStock category").lean(),
      Customer.find({ shop: req.userId }).select("name phone outstandingBalance").lean()
    ]);
    const productContext = products.map(p => ({ id: String(p._id), name: p.name, stock: p.quantity, unit: p.unit, sellingPrice: p.sellingPrice, minStock: p.minStock }));
    const customerContext = customers.map(c => ({ id: String(c._id), name: c.name, phone: c.phone || "", outstandingBalance: Number(c.outstandingBalance || 0) }));

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL, temperature: 0, max_completion_tokens: 1400,
      messages: [
        { role: "system", content: `You are DukaanSathi, a careful voice-command parser for a small Indian shop. Understand Hindi, Hinglish and English. Return only JSON matching the schema. Never invent IDs, names, quantities, prices, cash amounts or payment amounts. Use ONLY the supplied shop catalogue and customer list.

LANGUAGE AND PRODUCT NAME RULES:

- Understand commands in Hindi, Hinglish and English.
- Always return NEW product names in English using Latin/Roman script.
- Translate generic Hindi product names into their English equivalents.
- Preserve brand names using their commonly recognized English spelling.
- Never return product names in Devanagari script.
- Product categories must also be in English.
- Use English for units such as piece, packet, kg, litre, box.
- Apply these rules to productName in both ADD_PRODUCT and SALE intents.
- Do not translate customer names. Preserve their original spelling.
- Do not invent or guess product names when the meaning is unclear.

Supported intents:
- SALE: sold existing catalogue products. Match exact IDs and quantities. cashReceived must be explicitly stated; otherwise null and ask. Credit requires a customer.
- PAYMENT: a named existing customer paid toward khata. Match customer ID and amount.
- ADD_PRODUCT: create a NEW catalogue product. Extract productName, purchasePrice, sellingPrice and quantity. These four fields are required. category, unit and minStock are optional. Do not treat a request to increase existing stock as ADD_PRODUCT. If a required field is missing, set needsClarification=true and ask for that specific missing information. Never invent a price or quantity. Use category null if not stated, unit null if not stated, minStock null if not stated.
- ADD_CUSTOMER: create a NEW customer. Extract customerName. customerPhone and customerNotes are optional; use null if not stated. A phone number must be copied exactly as spoken/transcribed; never invent one. If customerName is missing, ask for it. Do not confuse mentioning an existing customer in a sale/payment command with creating a customer.
- RESTOCK: add stock to an EXISTING product. Match its exact productId and put the positive number of units to add in stockChange. If product or amount is unclear, ask.
- LOW_STOCK_QUERY: asks which items are low/out of stock.
- STOCK_QUERY: asks stock of a particular existing product; fill productId.
- CUSTOMER_CREDIT_QUERY: asks how much a named existing customer owes or has outstanding in khata. Match the exact customerId and customerName from the supplied customer list. This is a READ-ONLY query; never treat it as a PAYMENT and never change the balance. If the customer is unclear or not found, ask for the customer name.
- UNKNOWN: anything else or unclear.

For ADD_CUSTOMER, do not create a duplicate if the customer name already exists (case-insensitive) or if a non-empty phone number already belongs to a supplied customer; set needsClarification=true and explain that the customer already exists.\nFor ADD_PRODUCT, do not create a duplicate if the name already exists in the supplied catalogue; identify it as an existing product by returning ADD_PRODUCT with productName and set needsClarification=true with a message that it already exists and the user can add stock instead. For RESTOCK, only select a clear product match. Keep responseText and clarificationQuestion in the language/style of the user.

SHOP PRODUCTS: ${JSON.stringify(productContext)}
SHOP CUSTOMERS: ${JSON.stringify(customerContext)}` },
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_schema", json_schema: { name: "dukaansathi_voice_command", strict: true, schema: commandSchema } }
    });
    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response.");
    const validation = parsedCommandSchema.safeParse(JSON.parse(raw));
    if (!validation.success) throw new Error("The AI response did not match the expected command format.");
    const command = validation.data;

    if (command.intent === "ADD_CUSTOMER") {
      const normalizedName = command.customerName.trim().toLocaleLowerCase();
      const normalizedPhone = (command.customerPhone || "").replace(/\s+/g, "");
      const existing = customers.find(c =>
        c.name.trim().toLocaleLowerCase() === normalizedName ||
        (normalizedPhone && (c.phone || "").replace(/\s+/g, "") === normalizedPhone)
      );
      const missing = !command.customerName.trim();
      const clarificationQuestion = existing
        ? `${existing.name} already exists in your customer list. You can select that customer instead.`
        : missing ? "Please tell me the customer's name." : command.clarificationQuestion;
      return res.json({ success: true, interpretation: {
        ...command,
        customerName: existing?.name || command.customerName,
        customerPhone: command.customerPhone || "",
        customerNotes: command.customerNotes || "",
        duplicateCustomer: Boolean(existing),
        existingCustomerId: existing ? String(existing._id) : null,
        needsClarification: command.needsClarification || Boolean(existing) || missing,
        clarificationQuestion: existing || missing ? clarificationQuestion : command.clarificationQuestion
      } });
    }

    if (command.intent === "ADD_PRODUCT") {
      const existing = products.find(p => p.name.toLocaleLowerCase() === command.productName.trim().toLocaleLowerCase());
      const missing = !command.productName.trim() ? "product name" : command.purchasePrice === null ? "purchase price" : command.sellingPrice === null ? "selling price" : command.quantity === null ? "opening quantity" : "";
      const clarificationQuestion = existing ? `${existing.name} already exists in your catalogue. Would you like to add stock to it instead?` : missing ? `Please tell me the ${missing}.` : command.clarificationQuestion;
      return res.json({ success: true, interpretation: { ...command, productName: existing?.name || command.productName, category: command.category || "General", unit: command.unit || "piece", minStock: command.minStock ?? 5, duplicateProduct: Boolean(existing), needsClarification: command.needsClarification || Boolean(existing) || Boolean(missing), clarificationQuestion: existing || missing ? clarificationQuestion : command.clarificationQuestion } });
    }

    if (command.intent === "RESTOCK") {
      const product = command.productId ? products.find(p => String(p._id) === command.productId) : null;
      const validAmount = Number.isInteger(command.stockChange) && command.stockChange > 0;
      return res.json({ success: true, interpretation: { ...command, productId: product ? String(product._id) : null, product: product ? { name: product.name, quantity: product.quantity, unit: product.unit } : null, needsClarification: command.needsClarification || !product || !validAmount, clarificationQuestion: !product ? "Which existing product should I add stock to?" : !validAmount ? "How many units should I add?" : command.clarificationQuestion } });
    }

    if (command.intent === "SALE") {
      const mappedItems = command.items.map(item => {
        const product = products.find(p => String(p._id) === item.productId);
        if (!product || item.quantity < 1) return null;
        return { productId: String(product._id), productName: product.name, quantity: item.quantity, unit: product.unit, unitPrice: product.sellingPrice, lineTotal: Math.round(product.sellingPrice * item.quantity * 100) / 100, availableStock: product.quantity };
      });
      const invalidItem = mappedItems.some(item => !item);
      const estimatedTotal = Math.round(mappedItems.reduce((sum, item) => sum + (item?.lineTotal || 0), 0) * 100) / 100;
      const customer = command.customerId ? customers.find(c => String(c._id) === command.customerId) : null;
      return res.json({ success: true, interpretation: { ...command, items: mappedItems.filter(Boolean), customerId: customer ? String(customer._id) : null, customerName: customer?.name || "", estimatedTotal, needsClarification: command.needsClarification || invalidItem || mappedItems.length === 0 || (command.customerId && !customer) || command.cashReceived === null, clarificationQuestion: invalidItem ? "I could not match one of the products. Please select the correct product." : mappedItems.length === 0 ? "Which product and quantity did you sell?" : command.cashReceived === null ? "How much cash did you receive?" : command.clarificationQuestion } });
    }

    if (command.intent === "PAYMENT") {
      const customer = command.customerId ? customers.find(c => String(c._id) === command.customerId) : null;
      return res.json({ success: true, interpretation: { ...command, customerId: customer ? String(customer._id) : null, customerName: customer?.name || "", outstandingBalance: customer?.outstandingBalance ?? null, needsClarification: command.needsClarification || !customer || !command.amount, clarificationQuestion: !customer ? "Which saved customer made this payment?" : !command.amount ? "How much payment did the customer give?" : command.clarificationQuestion } });
    }

    if (command.intent === "LOW_STOCK_QUERY") {
      const lowStock = products.filter(p => p.quantity <= p.minStock).map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit, minStock: p.minStock }));
      return res.json({ success: true, interpretation: { ...command, lowStock, responseText: lowStock.length ? `Low stock items: ${lowStock.map(p => `${p.name}: ${p.quantity} ${p.unit}`).join(", ")}.` : "Good news! There are no low-stock products right now.", needsClarification: false } });
    }

    if (command.intent === "CUSTOMER_CREDIT_QUERY") {
      const customer = command.customerId
        ? customers.find(c => String(c._id) === command.customerId)
        : customers.find(c => c.name.trim().toLocaleLowerCase() === command.customerName.trim().toLocaleLowerCase());
      if (!customer) {
        return res.json({ success: true, interpretation: {
          ...command,
          needsClarification: true,
          clarificationQuestion: command.customerName
            ? `I could not find ${command.customerName} in your customer list. Please check the name.`
            : "Whose outstanding credit would you like to check?"
        } });
      }
      const balance = Number(customer.outstandingBalance || 0);
      const responseText = balance > 0
        ? `${customer.name} has ₹${balance.toFixed(2)} outstanding in khata.`
        : `${customer.name} has no outstanding credit.`;
      return res.json({ success: true, interpretation: {
        ...command,
        customerId: String(customer._id),
        customerName: customer.name,
        outstandingBalance: balance,
        responseText,
        needsClarification: false
      } });
    }

    if (command.intent === "STOCK_QUERY") {
      const product = command.productId ? products.find(p => String(p._id) === command.productId) : null;
      if (!product) return res.json({ success: true, interpretation: { ...command, needsClarification: true, clarificationQuestion: "Which product's stock would you like to check?" } });
      return res.json({ success: true, interpretation: { ...command, product: { name: product.name, quantity: product.quantity, unit: product.unit, minStock: product.minStock }, responseText: `${product.name} has ${product.quantity} ${product.unit} in stock.`, needsClarification: false } });
    }
    return res.json({ success: true, interpretation: command });
  } catch (error) {
    console.error("Voice interpretation error:", error.message);
    if (error.status === 429) return res.status(429).json({ success: false, message: "AI request limit reached. Please wait a little and try again." });
    return res.status(502).json({ success: false, message: "I could not understand that command. Please try saying it another way." });
  }
}
