import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CircleHelp, Languages, Mic, MicOff, RefreshCw, Send, Volume2, WandSparkles } from "lucide-react";
import api from "./api";

function speak(text, language) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "en-IN" ? "en-IN" : "hi-IN";
  const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === utterance.lang.toLowerCase())
    || window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(language === "en-IN" ? "en" : "hi"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export default function VoiceAssistant({ user, onLogout }) {
  const [language, setLanguage] = useState("hi-IN");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [interpretation, setInterpretation] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [cashReceived, setCashReceived] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", category: "General", purchasePrice: "", sellingPrice: "", quantity: "", unit: "piece", minStock: "5" });
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", notes: "" });
  const [restockQuantity, setRestockQuantity] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    api.get("/api/customers").then(({ data }) => setCustomers(data.customers || [])).catch(() => {});
    return () => {
      recognitionRef.current?.stop?.();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function startRecording() {
    setError(""); setMessage("");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice recording is not supported in this browser. Please use Chrome or type your command below.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = event => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interimText += event.results[i][0].transcript;
      }
      setTranscript(finalText || interimText);
    };
    recognition.onerror = event => {
      setListening(false);
      setError(event.error === "not-allowed" ? "Microphone permission was blocked. Allow microphone access in your browser." : `Voice input error: ${event.error}. You can type the command instead.`);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopRecording() {
    recognitionRef.current?.stop?.();
    setListening(false);
  }

  async function interpretCommand(event) {
    event.preventDefault();
    if (transcript.trim().length < 2) return;
    setBusy(true); setError(""); setMessage(""); setInterpretation(null);
    try {
      const { data } = await api.post("/api/voice/interpret", { transcript: transcript.trim() });
      const result = data.interpretation;
      setInterpretation(result);
      setCustomerId(result.customerId || "");
      setCashReceived(result.cashReceived === null || result.cashReceived === undefined ? "" : String(result.cashReceived));
      setPaymentAmount(result.amount === null || result.amount === undefined ? "" : String(result.amount));
      if (result.intent === "ADD_CUSTOMER") {
        setNewCustomer({ name: result.customerName || "", phone: result.customerPhone || "", notes: result.customerNotes || "" });
      }
      if (result.intent === "ADD_PRODUCT") {
        setNewProduct({
          name: result.productName || "", category: result.category || "General",
          purchasePrice: result.purchasePrice == null ? "" : String(result.purchasePrice),
          sellingPrice: result.sellingPrice == null ? "" : String(result.sellingPrice),
          quantity: result.quantity == null ? "" : String(result.quantity),
          unit: result.unit || "piece", minStock: String(result.minStock ?? 5)
        });
      }
      setRestockQuantity(result.stockChange == null ? "" : String(result.stockChange));
      if (result.responseText) speak(result.responseText, language);
      else if (result.clarificationQuestion) speak(result.clarificationQuestion, language);
    } catch (err) {
      setError(err.response?.data?.message || "Could not understand the command. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSale() {
    if (!interpretation) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const { data } = await api.post("/api/transactions/sales", {
        customerId: customerId || null,
        items: interpretation.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
        cashReceived: Number(cashReceived),
        description: `Recorded by voice assistant: ${transcript.trim()}`
      }, { headers: { "Idempotency-Key": idempotencyKey } });
      const successText = `Sale recorded successfully. Total ₹${Number(data.transaction.totalAmount).toFixed(2)}. Cash received ₹${Number(data.transaction.cashReceived).toFixed(2)}. Credit ₹${Number(data.transaction.creditAmount).toFixed(2)}.`;
      setMessage(successText);
      speak("Sale successfully recorded.", language);
      setInterpretation(null); setTranscript("");
      api.get("/api/customers").then(({ data: customerData }) => setCustomers(customerData.customers || [])).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.message || "Could not record the sale.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAddCustomer() {
    if (!interpretation || interpretation.intent !== "ADD_CUSTOMER" || interpretation.duplicateCustomer) return;
    if (!newCustomer.name.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { name: newCustomer.name.trim(), phone: newCustomer.phone.trim(), notes: newCustomer.notes.trim() };
      const { data } = await api.post("/api/customers", payload);
      setMessage(`${data.customer.name} added successfully to your customer list.`);
      speak(`${data.customer.name} customer successfully added.`, language);
      setInterpretation(null); setTranscript("");
      const refreshed = await api.get("/api/customers");
      setCustomers(refreshed.data.customers || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add the customer.");
    } finally { setBusy(false); }
  }

  async function confirmAddProduct() {
    if (!interpretation || interpretation.intent !== "ADD_PRODUCT") return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = {
        name: newProduct.name.trim(), category: newProduct.category.trim() || "General",
        purchasePrice: Number(newProduct.purchasePrice), sellingPrice: Number(newProduct.sellingPrice),
        quantity: Number(newProduct.quantity), unit: newProduct.unit.trim() || "piece", minStock: Number(newProduct.minStock)
      };
      const { data } = await api.post("/api/products", payload);
      const successText = `${data.product.name} added successfully with ${data.product.quantity} ${data.product.unit} in opening stock.`;
      setMessage(successText); speak(`${data.product.name} product successfully added.`, language);
      setInterpretation(null); setTranscript("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not add the product.");
    } finally { setBusy(false); }
  }

  async function confirmRestock() {
    if (!interpretation?.productId || !Number.isInteger(Number(restockQuantity)) || Number(restockQuantity) <= 0) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.post(`/api/products/${interpretation.productId}/stock`, { change: Number(restockQuantity), reason: "RESTOCK" });
      const successText = `${data.product.name} stock updated. New stock: ${data.product.quantity} ${data.product.unit}.`;
      setMessage(successText); speak("Product stock successfully updated.", language);
      setInterpretation(null); setTranscript("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not update product stock.");
    } finally { setBusy(false); }
  }

  async function confirmPayment() {
    if (!interpretation?.customerId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await api.post(`/api/transactions/customers/${interpretation.customerId}/payments`, {
        amount: Number(paymentAmount), description: `Payment recorded by voice assistant: ${transcript.trim()}`
      });
      const successText = `Payment of ₹${Number(data.transaction.totalAmount).toFixed(2)} recorded for ${interpretation.customerName}.`;
      setMessage(successText); speak("Payment successfully recorded.", language);
      setInterpretation(null); setTranscript("");
      api.get("/api/customers").then(({ data: customerData }) => setCustomers(customerData.customers || [])).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.message || "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  }

  const total = Number(interpretation?.estimatedTotal || 0);
  const cash = cashReceived === "" ? null : Number(cashReceived);
  const credit = cash === null ? null : Math.max(0, total - cash);
  const saleReady = interpretation?.intent === "SALE" && interpretation.items?.length > 0
    && interpretation.items.every(item => item?.productId && item.quantity > 0 && item.quantity <= item.availableStock)
    && cash !== null && Number.isFinite(cash) && cash >= 0 && cash <= total
    && (credit === 0 || Boolean(customerId));
  const paymentReady = interpretation?.intent === "PAYMENT" && interpretation.customerId && paymentAmount !== ""
    && Number(paymentAmount) > 0 && Number(paymentAmount) <= Number(interpretation.outstandingBalance || 0);

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><span className="brand-store">DS</span></div><div><strong>DukaanSathi</strong><span>Your shop, your voice.</span></div></div>
      <div className="shop-chip"><span className="shop-avatar">{(user?.shopName || "D").charAt(0).toUpperCase()}</span><div><b>{user?.shopName}</b><small>Shop workspace</small></div></div>
      <nav className="side-nav"><a href="/dashboard">◫ &nbsp; Overview</a><a href="/products">▦ &nbsp; Products & stock</a><a href="/customers">♙ &nbsp; Customers</a><a href="/sales">▤ &nbsp; Sales & Khata</a><a className="active" href="/assistant">🎙 &nbsp; Voice assistant</a></nav>
      <div className="sidebar-bottom"><div className="side-user"><div className="user-dot">{(user?.ownerName || "U").charAt(0).toUpperCase()}</div><div><b>{user?.ownerName}</b><small>{user?.email}</small></div></div><button className="logout-btn full" onClick={onLogout}>Log out</button></div>
    </aside>
    <section className="main-area"><header className="topbar"><span>Shop workspace <span className="crumb">/ voice assistant</span></span><span className="online-dot">● &nbsp;Workspace active</span></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR SHOP, YOUR VOICE</div><h1>AI Voice Assistant</h1><p className="muted">Speak naturally. Review what DukaanSathi understood. Confirm before anything is saved.</p></div><span className="count-pill">Hindi · Hinglish · English</span></div>
        <section className="voice-hero"><div className="voice-hero-copy"><div className="eyebrow light">DUKAANSATHI AI</div><h2>Namaste! Aaj dukaan mein kya hua?</h2><p>Add customers and products, update stock, record sales, collect khata payments, or ask about your stock — just say it.</p></div><div className={`voice-mic-orb ${listening ? "is-listening" : ""}`}><Mic size={34}/></div></section>
        {error && <div className="error">{error}</div>}{message && <div className="success-message"><CheckCircle2 size={16}/> {message}</div>}
        <section className="content-card voice-input-card">
          <div className="voice-toolbar"><label className="language-picker"><Languages size={16}/> Language<select value={language} onChange={e => setLanguage(e.target.value)}><option value="hi-IN">Hindi / Hinglish</option><option value="en-IN">English (India)</option></select></label><span className="muted">Microphone access is required for recording</span></div>
          <div className="record-row"><button type="button" className={`record-btn ${listening ? "recording" : ""}`} onClick={listening ? stopRecording : startRecording}>{listening ? <MicOff size={20}/> : <Mic size={20}/>} {listening ? "Stop recording" : "Start speaking"}</button><span className="record-hint">{listening ? "Listening… speak clearly" : "Or type your command below"}</span></div>
          <form onSubmit={interpretCommand}>
            <label className="transcript-label">What I heard<textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3} placeholder={'Example: "Ramesh ko 5 Maggi bechi, 40 rupaye cash mile."'} maxLength={1000}/></label>
            <div className="interpret-actions"><button type="button" className="outline-btn" onClick={() => { setTranscript(""); setInterpretation(null); setError(""); setMessage(""); }}><RefreshCw size={14}/> Clear</button><button className="primary-btn compact" disabled={busy || transcript.trim().length < 2}>{busy ? "Understanding…" : "Understand command"} <WandSparkles size={16}/></button></div>
          </form>
          <div className="example-commands"><b>Try saying</b><span>“Naya customer Ramesh Kumar add karo, phone 9876543210”</span><span>“Naya product Maggi add karo, purchase price 10, selling price 12, quantity 50 packet”</span><span>“Amul Milk ka stock 20 packet badha do”</span><span>“Ramesh ko 5 Maggi bechi, 40 rupaye cash mile”</span><span>“Ramesh ne 200 rupaye khate mein diye”</span><span>“Ramesh ka kitna udhaar baaki hai?”</span><span>“How much credit does Ramesh owe?”</span><span>“Kaunse products ka stock kam hai?”</span></div>
        </section>

        {interpretation && <section className="content-card interpretation-card">
          <div className="card-heading"><div><div className="eyebrow">AI UNDERSTANDING</div><h3>Review before confirming</h3></div><span className="type-pill">{interpretation.intent?.replaceAll("_", " ")}</span></div>
          <p className="interpret-response">{interpretation.responseText || interpretation.clarificationQuestion || "Please review the details below."}</p>
          {interpretation.intent === "SALE" && <>
            <div className="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Line total</th><th>Available stock</th></tr></thead><tbody>{interpretation.items?.map((item, index) => <tr key={`${item.productId}-${index}`}><td><b>{item.productName}</b></td><td>{item.quantity} {item.unit}</td><td>₹{Number(item.unitPrice).toFixed(2)}</td><td>₹{Number(item.lineTotal).toFixed(2)}</td><td>{item.availableStock}</td></tr>)}</tbody></table></div>
            <div className="voice-confirm-grid"><label>Customer<select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Walk-in / no credit</option>{customers.map(c => <option key={c._id} value={c._id}>{c.name} · due ₹{Number(c.outstandingBalance || 0).toFixed(2)}</option>)}</select></label><label>Cash received (₹)<input type="number" min="0" max={total} step="0.01" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="Enter amount received"/></label></div>
            <div className="sale-totals"><div><small>Sale total</small><b>₹{total.toFixed(2)}</b></div><div><small>Cash received</small><b>{cash === null ? "—" : `₹${cash.toFixed(2)}`}</b></div><div><small>Customer credit</small><b className={credit > 0 ? "credit-text" : ""}>{credit === null ? "—" : `₹${credit.toFixed(2)}`}</b></div></div>
            {interpretation.items?.some(item => item.quantity > item.availableStock) && <div className="error">The requested quantity is greater than available stock.</div>}
            {cash !== null && credit > 0 && !customerId && <div className="error">Select a customer to record the unpaid amount as khata credit.</div>}
            <button className="primary-btn compact" disabled={busy || !saleReady} onClick={confirmSale}>Confirm and record sale <ArrowRight size={16}/></button>
          </>}
          {interpretation.intent === "ADD_CUSTOMER" && <>
            <p className="muted">Review the customer details. Name is required; phone and notes are optional. Nothing is saved until you confirm.</p>
            <div className="voice-confirm-grid">
              <label>Customer name<input value={newCustomer.name} onChange={e => setNewCustomer(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Ramesh Kumar" /></label>
              <label>Phone number<input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer(v => ({ ...v, phone: e.target.value }))} placeholder="Optional" /></label>
              <label>Notes<input value={newCustomer.notes} onChange={e => setNewCustomer(v => ({ ...v, notes: e.target.value }))} placeholder="Optional notes" /></label>
            </div>
            {interpretation.needsClarification && interpretation.clarificationQuestion && <div className="clarification-note"><CircleHelp size={17}/><span>{interpretation.clarificationQuestion}</span></div>}
            {interpretation.duplicateCustomer && <p className="muted">This customer is already in your list. No duplicate will be created.</p>}
            <button className="primary-btn compact" disabled={busy || interpretation.duplicateCustomer || !newCustomer.name.trim()} onClick={confirmAddCustomer}>Confirm and add customer <ArrowRight size={16}/></button>
          </>}
          {interpretation.intent === "ADD_PRODUCT" && <>
            <p className="muted">Check the product details. You can edit any field before adding it to your catalogue.</p>
            <div className="voice-confirm-grid">
              <label>Product name<input value={newProduct.name} onChange={e => setNewProduct(v => ({ ...v, name: e.target.value }))} /></label>
              <label>Category<input value={newProduct.category} onChange={e => setNewProduct(v => ({ ...v, category: e.target.value }))} /></label>
              <label>Purchase price (₹)<input type="number" min="0" step="0.01" value={newProduct.purchasePrice} onChange={e => setNewProduct(v => ({ ...v, purchasePrice: e.target.value }))} /></label>
              <label>Selling price (₹)<input type="number" min="0" step="0.01" value={newProduct.sellingPrice} onChange={e => setNewProduct(v => ({ ...v, sellingPrice: e.target.value }))} /></label>
              <label>Opening quantity<input type="number" min="0" step="1" value={newProduct.quantity} onChange={e => setNewProduct(v => ({ ...v, quantity: e.target.value }))} /></label>
              <label>Unit<input value={newProduct.unit} onChange={e => setNewProduct(v => ({ ...v, unit: e.target.value }))} placeholder="piece, packet, kg" /></label>
              <label>Minimum stock alert<input type="number" min="0" step="1" value={newProduct.minStock} onChange={e => setNewProduct(v => ({ ...v, minStock: e.target.value }))} /></label>
            </div>
            {interpretation.needsClarification && interpretation.clarificationQuestion && <div className="clarification-note"><CircleHelp size={17}/><span>{interpretation.clarificationQuestion}</span></div>}
            {interpretation.duplicateProduct && <p className="muted">Use a stock update command for this existing product instead.</p>}
            <button className="primary-btn compact" disabled={busy || interpretation.duplicateProduct || !newProduct.name.trim() || newProduct.purchasePrice === "" || newProduct.sellingPrice === "" || newProduct.quantity === "" || !Number.isFinite(Number(newProduct.purchasePrice)) || !Number.isFinite(Number(newProduct.sellingPrice)) || !Number.isInteger(Number(newProduct.quantity)) || Number(newProduct.quantity) < 0 || !Number.isInteger(Number(newProduct.minStock)) || Number(newProduct.minStock) < 0} onClick={confirmAddProduct}>Confirm and add product <ArrowRight size={16}/></button>
          </>}
          {interpretation.intent === "RESTOCK" && <>
            <div className="voice-confirm-grid">
              <label>Product<input value={interpretation.product?.name || "Product not matched"} readOnly /></label>
              <label>Current stock<input value={interpretation.product ? `${interpretation.product.quantity} ${interpretation.product.unit}` : "Unknown"} readOnly /></label>
              <label>Quantity to add<input type="number" min="1" step="1" value={restockQuantity} onChange={e => setRestockQuantity(e.target.value)} /></label>
            </div>
            {interpretation.needsClarification && interpretation.clarificationQuestion && <div className="clarification-note"><CircleHelp size={17}/><span>{interpretation.clarificationQuestion}</span></div>}
            <button className="primary-btn compact" disabled={busy || !interpretation.productId || !Number.isInteger(Number(restockQuantity)) || Number(restockQuantity) <= 0} onClick={confirmRestock}>Confirm stock update <ArrowRight size={16}/></button>
          </>}
          {interpretation.intent === "PAYMENT" && <>
            <div className="voice-confirm-grid"><label>Customer<input value={interpretation.customerName || "Customer not matched"} readOnly/></label><label>Outstanding balance<input value={interpretation.outstandingBalance == null ? "Unknown" : `₹${Number(interpretation.outstandingBalance).toFixed(2)}`} readOnly/></label><label>Payment received (₹)<input type="number" min="0.01" max={interpretation.outstandingBalance || undefined} step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount"/></label></div>
            {interpretation.customerId && Number(paymentAmount) > Number(interpretation.outstandingBalance || 0) && <div className="error">Payment cannot exceed the outstanding balance.</div>}
            <button className="primary-btn compact" disabled={busy || !paymentReady} onClick={confirmPayment}>Confirm and record payment <ArrowRight size={16}/></button>
          </>}
          {interpretation.intent === "LOW_STOCK_QUERY" && <div className="voice-result-list">{interpretation.lowStock?.length ? interpretation.lowStock.map(item => <div className="list-row" key={item.name}><b>{item.name}</b><span className="stock-warning">{item.quantity} {item.unit} left · min {item.minStock}</span></div>) : <p className="muted">No low-stock products.</p>}</div>}
          {interpretation.intent === "CUSTOMER_CREDIT_QUERY" && interpretation.customerName && <div className="stock-answer">
            <b>{interpretation.customerName}</b>
            <strong>₹{Number(interpretation.outstandingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            <span className="muted">{Number(interpretation.outstandingBalance || 0) > 0 ? "Outstanding customer credit (Khata)" : "No outstanding credit"}</span>
          </div>}
          {interpretation.intent === "STOCK_QUERY" && interpretation.product && <div className="stock-answer"><b>{interpretation.product.name}</b><strong>{interpretation.product.quantity} {interpretation.product.unit}</strong><span className="muted">Minimum stock: {interpretation.product.minStock}</span></div>}
          {interpretation.needsClarification && interpretation.clarificationQuestion && !["SALE", "PAYMENT", "ADD_PRODUCT", "ADD_CUSTOMER", "RESTOCK"].includes(interpretation.intent) && <div className="clarification-note"><CircleHelp size={17}/><span>{interpretation.clarificationQuestion}</span></div>}
          {interpretation.intent === "UNKNOWN" && <div className="clarification-note"><CircleHelp size={17}/><span>Try a command about adding a customer or product, updating stock, recording a sale, receiving a payment, checking customer credit, or checking stock.</span></div>}
          <div className="interpret-footer"><button className="text-btn" onClick={() => speak(interpretation.responseText || interpretation.clarificationQuestion || "Please review the details.", language)}><Volume2 size={15}/> Read aloud</button><button className="text-btn" onClick={() => setInterpretation(null)}>Dismiss</button></div>
        </section>}
        <div className="voice-safety-note"><CheckCircle2 size={17}/><span><b>You stay in control.</b> The AI only prepares a suggestion. No customer, product, stock, sale, or payment change is saved until you press the confirmation button.</span></div>
      </div>
    </section>
  </main>;
}
