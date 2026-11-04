import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, NavLink } from "react-router-dom";
import {Store, Mic, ChartNoAxesCombined, Package, Users, LogOut, ArrowRight, ShieldCheck, Plus, Search, Trash2, Pencil, RefreshCw, AlertTriangle, LayoutDashboard, ShoppingCart, CreditCard, TrendingUp } from "lucide-react";
import api from "./api";
import VoiceAssistant from "./VoiceAssistant";

function Brand() {
  return <div className="brand"><div className="brand-mark"><Store size={22} /></div><div><strong>DukaanSathi</strong><span>Your shop, your voice.</span></div></div>;
}

function AuthLayout({ children, eyebrow, title, description }) {
  return <main className="auth-shell">
    <section className="auth-visual"><Brand /><div className="visual-copy"><div className="eyebrow light">A smarter way to run your shop</div><h1>Spend less time<br />on records. <em>More time</em><br />with customers.</h1><p>Speak naturally. Keep your sales, stock and customer khata organised in one place.</p><div className="voice-orb"><Mic size={30} /><span className="orb-ring ring-one"></span><span className="orb-ring ring-two"></span></div><div className="visual-caption">Hindi · Hinglish · English</div></div><div className="visual-footer"><ShieldCheck size={15} /> Your shop data stays tied to your account.</div></section>
    <section className="auth-panel"><div className="mobile-brand"><Brand /></div><div className="auth-card"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p className="muted">{description}</p>{children}</div><div className="panel-footer">Built for the people who keep local businesses moving.</div></section>
  </main>;
}

function Register({ onAuthenticated }) {
  const [form, setForm] = useState({ shopName: "", ownerName: "", email: "", password: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  function update(e) { setForm({ ...form, [e.target.name]: e.target.value }); }
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const { data } = await api.post("/api/auth/register", form); onAuthenticated(data.user); navigate("/dashboard"); }
    catch (err) { setError(err.response?.data?.message || "Could not create your account. Check the backend is running."); }
    finally { setLoading(false); }
  }
  return <AuthLayout eyebrow="Get started" title="Create your shop account" description="Set up your digital shop assistant in less than a minute.">
    <form onSubmit={submit} className="auth-form">
      <label>Shop name<input name="shopName" value={form.shopName} onChange={update} placeholder="e.g. Sharma General Store" required minLength="2" /></label>
      <label>Owner name<input name="ownerName" value={form.ownerName} onChange={update} placeholder="Your full name" required minLength="2" /></label>
      <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" required minLength="8" /></label>
      {error && <div className="error">{error}</div>}<button className="primary-btn" disabled={loading}>{loading ? "Creating account..." : "Create account"} <ArrowRight size={17} /></button>
    </form><div className="auth-switch">Already have an account? <Link to="/login">Log in</Link></div>
  </AuthLayout>;
}

function Login({ onAuthenticated }) {
  const [form, setForm] = useState({ email: "", password: "" }); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  function update(e) { setForm({ ...form, [e.target.name]: e.target.value }); }
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const { data } = await api.post("/api/auth/login", form); onAuthenticated(data.user); navigate("/dashboard"); }
    catch (err) { setError(err.response?.data?.message || "Could not log in. Check your details and backend."); }
    finally { setLoading(false); }
  }
  return <AuthLayout eyebrow="Welcome back" title="Log in to your shop" description="Your shop's daily activity is just a conversation away.">
    <form onSubmit={submit} className="auth-form">
      <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required /></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={update} placeholder="Enter your password" required /></label>
      {error && <div className="error">{error}</div>}<button className="primary-btn" disabled={loading}>{loading ? "Logging in..." : "Log in"} <ArrowRight size={17} /></button>
    </form><div className="auth-switch">New to DukaanSathi? <Link to="/register">Create an account</Link></div>
  </AuthLayout>;
}

function AppShell({ user, onLogout, children }) {
  return <main className="app-shell">
    <aside className="sidebar"><Brand /><div className="shop-chip"><span className="shop-avatar">{(user?.shopName || "D").charAt(0).toUpperCase()}</span><div><b>{user?.shopName}</b><small>Shop workspace</small></div></div>
      <nav className="side-nav">
        <NavLink to="/dashboard"><LayoutDashboard size={17}/> Overview</NavLink>
        <NavLink to="/products"><Package size={17}/> Products & stock</NavLink>
        <NavLink to="/customers"><Users size={17}/> Customers</NavLink>
        <NavLink to="/sales"><ShoppingCart size={17}/> Sales & Khata</NavLink>
        <NavLink to="/assistant"><Mic size={17}/> Voice assistant</NavLink>
      </nav>
      <div className="sidebar-bottom"><div className="side-user"><div className="user-dot">{(user?.ownerName || "U").charAt(0).toUpperCase()}</div><div><b>{user?.ownerName}</b><small>{user?.email}</small></div></div><button className="logout-btn full" onClick={onLogout}><LogOut size={16}/> Log out</button></div>
    </aside>
    <section className="main-area"><header className="topbar"><span>Shop workspace <span className="crumb">/ {location.pathname.split("/")[1] || "dashboard"}</span></span><span className="online-dot">● &nbsp;Workspace active</span></header><div className="page-content">{children}</div></section>
  </main>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>;
}

function Dashboard({ user, onLogout }) {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  async function load() { try { const { data } = await api.get("/api/dashboard/summary"); setData(data); setError(""); } catch { setError("Could not load shop summary."); } }
  useEffect(() => { load(); }, []);
  return <AppShell user={user} onLogout={onLogout}>
    <PageHeading eyebrow="YOUR BUSINESS, AT A GLANCE" title={`Namaste, ${user?.ownerName || "Shopkeeper"} 👋`} description={`${user?.shopName} — your shop workspace.`} action={<button className="outline-btn" onClick={load}><RefreshCw size={15}/> Refresh</button>}/>
    {error && <div className="error">{error}</div>}
    <div className="welcome-banner"><div className="banner-icon"><Mic size={25}/></div><div><div className="eyebrow light">NEXT MILESTONE</div><h2>Your shop can now listen.</h2><p>Use Hindi, Hinglish or English to record sales, collect khata payments and check stock.</p><Link className="banner-link" to="/assistant">Open voice assistant <ArrowRight size={15}/></Link></div></div>
    <div className="stat-grid">
      <div className="stat-card"><span><Package size={18}/> Products in catalogue</span><strong>{data?.summary?.productCount ?? "—"}</strong><small>Items tracked in your shop</small></div>
      <div className="stat-card"><span><Users size={18}/> Customers</span><strong>{data?.summary?.customerCount ?? "—"}</strong><small>Saved customer profiles</small></div>
      <div className="stat-card"><span><AlertTriangle size={18}/> Low-stock products</span><strong>{data?.summary?.lowStockCount ?? "—"}</strong><small>At or below minimum stock</small></div>
      <div className="stat-card"><span><TrendingUp size={18}/> Overall gross profit</span><strong>₹{Number(data?.summary?.grossProfit ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>From completed sales · excludes shop expenses</small></div>
    </div>
    <div className="two-col">
      <section className="content-card"><div className="card-heading"><h3>Needs restocking</h3><Link to="/products">View products</Link></div>{data?.lowStock?.length ? data.lowStock.map(p=><div className="list-row" key={p._id}><div><b>{p.name}</b><small>Minimum: {p.minStock} {p.unit}</small></div><span className="stock-warning">{p.quantity} {p.unit} left</span></div>) : <div className="empty-small">No low-stock products yet.</div>}</section>
      <section className="content-card"><div className="card-heading"><h3>Recent stock activity</h3><Link to="/products">Manage stock</Link></div>{data?.recentMovements?.length ? data.recentMovements.map(m=><div className="list-row" key={m._id}><div><b>{m.productName}</b><small>{m.reason.replace("_"," ").toLowerCase()}</small></div><span className={m.change>0?"positive":"negative"}>{m.change>0?"+":""}{m.change}</span></div>) : <div className="empty-small">Stock changes will appear here.</div>}</section>
    </div>
  </AppShell>;
}

function Products({ user, onLogout }) {
  const blank = { name:"", category:"General", purchasePrice:"", sellingPrice:"", quantity:"", minStock:"5", unit:"piece" };
  const [items,setItems]=useState([]); const [form,setForm]=useState(blank); const [error,setError]=useState(""); const [loading,setLoading]=useState(false); const [editing,setEditing]=useState(null); const [stockFor,setStockFor]=useState(null); const [stockChange,setStockChange]=useState("");
  async function load(){try{const {data}=await api.get("/api/products");setItems(data.products);}catch(e){setError(e.response?.data?.message||"Could not load products.");}}
  useEffect(()=>{load();},[]);
  async function save(e){e.preventDefault();setError("");setLoading(true);try{const payload={...form,purchasePrice:Number(form.purchasePrice),sellingPrice:Number(form.sellingPrice),quantity:Number(form.quantity),minStock:Number(form.minStock)};if(editing)await api.patch(`/api/products/${editing}`,payload);else await api.post("/api/products",payload);setForm(blank);setEditing(null);await load();}catch(e){setError(e.response?.data?.message||"Could not save product.");}finally{setLoading(false);}}
  async function remove(id){if(!confirm("Delete this product?"))return;try{await api.delete(`/api/products/${id}`);await load();}catch(e){setError(e.response?.data?.message||"Could not delete product.");}}
  async function adjust(id){try{await api.post(`/api/products/${id}/stock`,{change:Number(stockChange),reason:Number(stockChange)>0?"RESTOCK":"CORRECTION"});setStockFor(null);setStockChange("");await load();}catch(e){setError(e.response?.data?.message||"Could not adjust stock.");}}
  function edit(p){setEditing(p._id);setForm({name:p.name,category:p.category,purchasePrice:String(p.purchasePrice),sellingPrice:String(p.sellingPrice),quantity:String(p.quantity),minStock:String(p.minStock),unit:p.unit});window.scrollTo({top:0,behavior:"smooth"});}
  return <AppShell user={user} onLogout={onLogout}>
    <PageHeading eyebrow="SHOP CATALOGUE" title="Products & stock" description="Keep product prices and available quantities up to date." action={<span className="count-pill">{items.length} products</span>}/>
    {error&&<div className="error">{error}</div>}
    <section className="content-card form-card"><div className="card-heading"><h3>{editing?"Edit product":"Add a product"}</h3>{editing&&<button className="text-btn" onClick={()=>{setEditing(null);setForm(blank);}}>Cancel edit</button>}</div>
      <form className="product-form" onSubmit={save}>
        <label>Product name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Maggi 70g" required/></label>
        <label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Grocery"/></label>
        <label>Purchase price (₹)<input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})} required/></label>
        <label>Selling price (₹)<input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={e=>setForm({...form,sellingPrice:e.target.value})} required/></label>
        <label>Opening quantity<input type="number" min="0" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required/></label>
        <label>Low-stock threshold<input type="number" min="0" step="1" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})}/></label>
        <label>Unit<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="piece, kg, packet"/></label>
        <button className="primary-btn compact" disabled={loading}><Plus size={16}/>{loading?"Saving...":editing?"Update product":"Add product"}</button>
      </form>
    </section>
    <section className="content-card table-card"><div className="card-heading"><h3>All products</h3><span className="muted">{items.length} records</span></div>
      {items.length===0?<div className="empty-state"><Package size={30}/><b>No products added yet</b><span>Add your first product using the form above.</span></div>:
      <div className="table-wrap"><table><thead><tr><th>Product</th><th>Purchase</th><th>Selling</th><th>Available stock</th><th>Actions</th></tr></thead><tbody>{items.map(p=><tr key={p._id}><td><b>{p.name}</b><small>{p.category}</small></td><td>₹{p.purchasePrice.toFixed(2)}</td><td>₹{p.sellingPrice.toFixed(2)}</td><td><span className={p.quantity<=p.minStock?"stock-warning":"stock-good"}>{p.quantity} {p.unit}</span></td><td><div className="row-actions"><button title="Adjust stock" onClick={()=>setStockFor(stockFor===p._id?null:p._id)}><RefreshCw size={15}/></button><button title="Edit" onClick={()=>edit(p)}><Pencil size={15}/></button><button title="Delete" onClick={()=>remove(p._id)}><Trash2 size={15}/></button></div>{stockFor===p._id&&<div className="stock-adjust"><input type="number" step="1" value={stockChange} onChange={e=>setStockChange(e.target.value)} placeholder="+10 or -2"/><button onClick={()=>adjust(p._id)} disabled={!stockChange||Number(stockChange)===0}>Apply</button></div>}</td></tr>)}</tbody></table></div>}
    </section>
  </AppShell>;
}


function Sales({ user, onLogout }) {
  const [products,setProducts]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [transactions,setTransactions]=useState([]);
  const [lines,setLines]=useState([{productId:"",quantity:1}]);
  const [customerId,setCustomerId]=useState("");
  const [cashReceived,setCashReceived]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function load(){
    try{
      const [p,c,t]=await Promise.all([
        api.get("/api/products"),api.get("/api/customers"),api.get("/api/transactions")
      ]);
      setProducts(p.data.products);setCustomers(c.data.customers);setTransactions(t.data.transactions);
    }catch(e){setError(e.response?.data?.message||"Could not load sales data.");}
  }
  useEffect(()=>{load();},[]);

  const total=lines.reduce((sum,line)=>{
    const product=products.find(p=>p._id===line.productId);
    return sum+(product?product.sellingPrice*Math.max(0,Number(line.quantity)||0):0);
  },0);
  const cash=Number(cashReceived)||0;
  const credit=Math.max(0,total-cash);

  function updateLine(index,key,value){
    setLines(old=>old.map((line,i)=>i===index?{...line,[key]:value}:line));
  }

  async function submit(e){
    e.preventDefault();setError("");setMessage("");
    if(cash>total){setError("Cash received cannot exceed the sale total.");return;}
    if(credit>0&&!customerId){setError("Choose a customer to record the remaining amount as credit.");return;}
    const selected=lines.filter(l=>l.productId&&Number(l.quantity)>0);
    if(!selected.length){setError("Add at least one product.");return;}
    const insufficient=selected.find(l=>{
      const p=products.find(x=>x._id===l.productId);return !p||Number(l.quantity)>p.quantity;
    });
    if(insufficient){setError("One of the selected products has insufficient stock.");return;}
    setLoading(true);
    try{
      const key=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
      const {data}=await api.post("/api/transactions/sales",{
        customerId:customerId||null,
        items:selected.map(l=>({productId:l.productId,quantity:Number(l.quantity)})),
        cashReceived:cash,
        description:"Sale recorded from dashboard"
      },{headers:{"Idempotency-Key":key}});
      setMessage(`Sale saved. Total ₹${Number(data.transaction.totalAmount).toFixed(2)}; credit ₹${Number(data.transaction.creditAmount).toFixed(2)}.`);
      setLines([{productId:"",quantity:1}]);setCustomerId("");setCashReceived("");
      await load();
    }catch(e){setError(e.response?.data?.message||"Could not record sale.");}
    finally{setLoading(false);}
  }

  return <AppShell user={user} onLogout={onLogout}>
    <PageHeading eyebrow="SALES & CUSTOMER CREDIT" title="Sales & Khata" description="Record a sale, collect part payment and automatically update stock and customer credit." action={<span className="count-pill">{transactions.length} recent entries</span>}/>
    {error&&<div className="error">{error}</div>}{message&&<div className="success-message">{message}</div>}
    <section className="content-card form-card">
      <div className="card-heading"><h3>Record a sale</h3><span className="muted">Prices are taken from your product catalogue</span></div>
      <form onSubmit={submit}>
        <div className="sale-lines">
          {lines.map((line,index)=><div className="sale-line" key={index}>
            <label>Product<select value={line.productId} onChange={e=>updateLine(index,"productId",e.target.value)} required>
              <option value="">Choose a product</option>
              {products.map(p=><option key={p._id} value={p._id} disabled={p.quantity===0}>{p.name} · ₹{p.sellingPrice} · stock {p.quantity}</option>)}
            </select></label>
            <label>Quantity<input type="number" min="1" step="1" value={line.quantity} onChange={e=>updateLine(index,"quantity",e.target.value)} required/></label>
            <button type="button" className="icon-btn danger" title="Remove line" disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,i)=>i!==index))}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <button type="button" className="text-btn add-line" onClick={()=>setLines([...lines,{productId:"",quantity:1}])}><Plus size={14}/> Add another item</button>
        <div className="sale-fields">
          <label>Customer (required when sale has credit)<select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Walk-in / no credit</option>{customers.map(c=><option key={c._id} value={c._id}>{c.name} · due ₹{Number(c.outstandingBalance||0).toFixed(2)}</option>)}</select></label>
          <label>Cash received (₹)<input type="number" min="0" step="0.01" value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder="Enter amount received" required/></label>
        </div>
        <div className="sale-totals"><div><small>Sale total</small><b>₹{total.toFixed(2)}</b></div><div><small>Cash received</small><b>₹{cash.toFixed(2)}</b></div><div><small>Customer credit</small><b className={credit>0?"credit-text":""}>₹{credit.toFixed(2)}</b></div></div>
        <button className="primary-btn compact" disabled={loading||total<=0}>{loading?"Saving sale...":"Confirm and record sale"} <ArrowRight size={15}/></button>
      </form>
    </section>
    <section className="content-card table-card"><div className="card-heading"><h3>Recent transactions</h3><button className="outline-btn" onClick={load}><RefreshCw size={14}/> Refresh</button></div>
      {transactions.length===0?<div className="empty-state"><ShoppingCart size={30}/><b>No transactions yet</b><span>Your sales and customer payments will appear here.</span></div>:
      <div className="table-wrap"><table><thead><tr><th>Type</th><th>Customer</th><th>Details</th><th>Total</th><th>Cash</th><th>Credit</th><th>Date</th></tr></thead><tbody>{transactions.map(t=><tr key={t._id}><td><span className="type-pill">{t.type}</span></td><td>{t.customerName||"Walk-in"}</td><td>{t.type==="SALE"?t.items.map(i=>`${i.productName} × ${i.quantity}`).join(", "):t.description}</td><td>₹{Number(t.totalAmount).toFixed(2)}</td><td>₹{Number(t.cashReceived).toFixed(2)}</td><td>₹{Number(t.creditAmount).toFixed(2)}</td><td>{new Date(t.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </section>
  </AppShell>;
}


function Customers({ user, onLogout }) {
  const [items,setItems]=useState([]);const [form,setForm]=useState({name:"",phone:"",notes:""});const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const [paymentCustomer,setPaymentCustomer]=useState(null);const [paymentAmount,setPaymentAmount]=useState("");
  const [message,setMessage]=useState("");
  async function load(){try{const {data}=await api.get("/api/customers");setItems(data.customers);}catch(e){setError(e.response?.data?.message||"Could not load customers.");}}
  useEffect(()=>{load();},[]);
  async function save(e){e.preventDefault();setError("");setMessage("");setLoading(true);try{await api.post("/api/customers",form);setForm({name:"",phone:"",notes:""});await load();}catch(e){setError(e.response?.data?.message||"Could not save customer.");}finally{setLoading(false);}}
  async function remove(id){if(!confirm("Delete this customer?"))return;try{await api.delete(`/api/customers/${id}`);await load();}catch(e){setError(e.response?.data?.message||"Could not delete customer.");}}
  async function receivePayment(e){e.preventDefault();setError("");setMessage("");try{const {data}=await api.post(`/api/transactions/customers/${paymentCustomer._id}/payments`,{amount:Number(paymentAmount),description:"Payment received at shop"});setMessage(`Payment of ₹${Number(data.transaction.totalAmount).toFixed(2)} recorded for ${paymentCustomer.name}.`);setPaymentCustomer(null);setPaymentAmount("");await load();}catch(e){setError(e.response?.data?.message||"Could not record payment.");}}
  const totalDue=items.reduce((sum,c)=>sum+Number(c.outstandingBalance||0),0);
  return <AppShell user={user} onLogout={onLogout}>
    <PageHeading eyebrow="CUSTOMER DIRECTORY" title="Customers" description="Manage customer details and collect outstanding Khata payments." action={<span className="count-pill">{items.length} customers</span>}/>
    {error&&<div className="error">{error}</div>}{message&&<div className="success-message">{message}</div>}
    <div className="stat-grid one-stat"><div className="stat-card"><span><CreditCard size={18}/> Total outstanding credit</span><strong>₹{totalDue.toFixed(2)}</strong><small>Across all customers in this shop</small></div></div>
    <section className="content-card form-card"><div className="card-heading"><h3>Add a customer</h3></div><form className="customer-form" onSubmit={save}>
      <label>Customer name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Ramesh Kumar" required/></label>
      <label>Phone number<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Optional"/></label>
      <label>Notes<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional notes"/></label>
      <button className="primary-btn compact" disabled={loading}><Plus size={16}/>{loading?"Saving...":"Add customer"}</button>
    </form></section>
    <section className="content-card table-card"><div className="card-heading"><h3>Customer list</h3><span className="muted">{items.length} records</span></div>
      {items.length===0?<div className="empty-state"><Users size={30}/><b>No customers yet</b><span>Add a customer to start building your shop directory.</span></div>:
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Outstanding</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{items.map(c=><tr key={c._id}><td><b>{c.name}</b></td><td>{c.phone||"—"}</td><td><span className={Number(c.outstandingBalance)>0?"stock-warning":"stock-good"}>₹{Number(c.outstandingBalance||0).toFixed(2)}</span></td><td>{c.notes||"—"}</td><td><div className="row-actions">{Number(c.outstandingBalance)>0&&<button title="Receive payment" onClick={()=>{setPaymentCustomer(c);setPaymentAmount(String(c.outstandingBalance));}}><CreditCard size={15}/></button>}<button title="Delete customer" onClick={()=>remove(c._id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {paymentCustomer&&<div className="modal-backdrop"><form className="payment-modal" onSubmit={receivePayment}><button type="button" className="modal-close" onClick={()=>setPaymentCustomer(null)}>×</button><div className="eyebrow">CUSTOMER PAYMENT</div><h3>Receive payment from {paymentCustomer.name}</h3><p className="muted">Outstanding balance: ₹{Number(paymentCustomer.outstandingBalance).toFixed(2)}</p><label>Amount received (₹)<input type="number" min="0.01" max={paymentCustomer.outstandingBalance} step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} required/></label><button className="primary-btn" disabled={!paymentAmount||Number(paymentAmount)<=0}>Save payment</button></form></div>}
  </AppShell>;
}

export default function App() {
  const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);const navigate=useNavigate();
  useEffect(()=>{api.get("/api/auth/me").then(({data})=>setUser(data.user)).catch(()=>setUser(null)).finally(()=>setChecking(false));},[]);
  async function logout(){try{await api.post("/api/auth/logout");}finally{setUser(null);navigate("/login");}}
  if(checking)return <div className="loading-screen">Loading DukaanSathi...</div>;
  return <Routes>
    <Route path="/" element={<Navigate to={user?"/dashboard":"/register"} replace/>}/>
    <Route path="/register" element={user?<Navigate to="/dashboard" replace/>:<Register onAuthenticated={setUser}/>}/>
    <Route path="/login" element={user?<Navigate to="/dashboard" replace/>:<Login onAuthenticated={setUser}/>}/>
    <Route path="/dashboard" element={user?<Dashboard user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/>
    <Route path="/products" element={user?<Products user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/>
    <Route path="/customers" element={user?<Customers user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/>
    <Route path="/sales" element={user?<Sales user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/>
    <Route path="/assistant" element={user?<VoiceAssistant user={user} onLogout={logout}/>:<Navigate to="/login" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
