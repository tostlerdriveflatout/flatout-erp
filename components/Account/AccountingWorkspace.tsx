'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';

type Row=Record<string,any>;
type Tab='Sales Accounting Overview'|'Payments'|'Outstanding Balances'|'Expenses'|'Vendor Bills'|'Financial Reports';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
const num=(n:any)=>Number(n||0);
const day=()=>new Date().toLocaleDateString('en-CA');
const categories=['Advertising','Bank Fees','Equipment','Insurance','Office','Professional Services','Rent','Repairs','Shipping','Software','Supplies','Travel','Utilities','Other'];

export default function AccountingWorkspace({tab,openOrder}:{tab:Tab;openOrder:(id:string)=>void}){
 const db=useMemo(()=>supabase(),[]);
 const [orders,setOrders]=useState<Row[]>([]),[expenses,setExpenses]=useState<Row[]>([]),[bills,setBills]=useState<Row[]>([]),[pos,setPos]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 const [expenseForm,setExpenseForm]=useState({expense_date:day(),vendor:'',description:'',category:'Software',amount:'',payment_method:'',reference:'',notes:''});
 const [billForm,setBillForm]=useState({bill_number:'',vendor:'',purchase_order_id:'',bill_date:day(),due_date:'',subtotal:'',tax_amount:'0',shipping_amount:'0',notes:''});
 const [expandedBill,setExpandedBill]=useState<string|null>(null);
  const [reportPeriod,setReportPeriod]=useState<'all'|'thisMonth'|'lastMonth'|'thisQuarter'|'thisYear'|'custom'>('thisMonth');
  const [reportStart,setReportStart]=useState('');
  const [reportEnd,setReportEnd]=useState('');
 const activeBillPayments=(b:Row):Row[]=>(b.vendor_bill_payments||[]).filter((p:Row)=>!p.reversed_at);
 const paidForBill=(b:Row):number=>activeBillPayments(b).reduce((sum:number,p:Row)=>sum+num(p.amount),0);
 const fetchAll=useCallback(async(table:string,select:string,sort:string)=>{
  const out:Row[]=[];for(let from=0;from<100000;from+=500){const {data,error}=await db.from(table).select(select).order(sort,{ascending:false}).range(from,from+499);if(error)throw new Error(`${table}: ${error.message}`);out.push(...(data||[]));if((data||[]).length<500)return out;}throw new Error(`${table}: over 100,000 records; reporting requires server-side pagination`);
 },[db]);
 const refresh=useCallback(async()=>{
  setBusy(true);setError('');try{
   const [o,e,b,p]=await Promise.all([
    fetchAll('orders','id,order_number,status,payment_status,tax_rate,tax_exempt,shipping_amount,created_at,customers(name),order_items(qty,sell_price,cost),payments(id,amount,payment_method,reference,paid_at),payment_adjustments(id,payment_id,adjustment_type,amount,created_at)','created_at'),
    fetchAll('expenses','*','expense_date'),
    fetchAll('vendor_bills','*,vendor_bill_payments(*)','bill_date'),
    fetchAll('purchase_orders','id,po_number,vendor','created_at')
   ]);setOrders(o);setExpenses(e);setBills(b);setPos(p);
  }catch(e:any){setError(e.message||'Unable to load accounting records.');}finally{setBusy(false);}
 },[fetchAll]);
 useEffect(()=>{void refresh();},[refresh]);
 const sales=useMemo<Row[]>(()=>orders.filter(o=>o.status!=='Draft').map(o=>{
  const subtotal=(o.order_items||[]).reduce((s:number,i:Row)=>s+num(i.qty)*num(i.sell_price),0);
  const cost=(o.order_items||[]).reduce((s:number,i:Row)=>s+num(i.qty)*num(i.cost),0);
  const tax=o.tax_exempt?0:subtotal*num(o.tax_rate)/100;
  const total=subtotal+tax+num(o.shipping_amount);
  const gross=(o.payments||[]).reduce((s:number,p:Row)=>s+num(p.amount),0);
  const adjustments=(o.payment_adjustments||[]).reduce((s:number,a:Row)=>s+num(a.amount),0);
  const paid=gross-adjustments;
  return {...o,subtotal,cost,tax,total,paid,balance:Math.max(0,total-paid)};
 }),[orders]);
 const sums=useMemo(()=>({orderValue:sales.reduce((a,o)=>a+o.total,0),paid:sales.reduce((a,o)=>a+o.paid,0),balance:sales.reduce((a,o)=>a+o.balance,0),salesSubtotal:sales.reduce((a,o)=>a+o.subtotal,0),estimatedCost:sales.reduce((a,o)=>a+o.cost,0),expenses:expenses.filter(e=>e.status==='Recorded').reduce((a,e)=>a+num(e.amount),0),billTotal:bills.filter(b=>b.status==='Open').reduce((a,b)=>a+num(b.subtotal)+num(b.tax_amount)+num(b.shipping_amount),0),billPaid:bills.filter(b=>b.status==='Open').reduce((a,b)=>a+paidForBill(b),0)}),[sales,expenses,bills]);
  // Reporting periods use local calendar dates. An empty bound means no limit.
  const reportBounds=useMemo(()=>{
    if(reportPeriod==='all')return {start:'',end:''};
    if(reportPeriod==='custom')return {start:reportStart,end:reportEnd};
    const today=new Date(),year=today.getFullYear(),month=today.getMonth();
    const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(reportPeriod==='thisMonth')return {start:fmt(new Date(year,month,1)),end:fmt(today)};
    if(reportPeriod==='lastMonth')return {start:fmt(new Date(year,month-1,1)),end:fmt(new Date(year,month,0))};
    if(reportPeriod==='thisQuarter')return {start:fmt(new Date(year,Math.floor(month/3)*3,1)),end:fmt(today)};
    return {start:fmt(new Date(year,0,1)),end:fmt(today)};
  },[reportPeriod,reportStart,reportEnd]);
  const reportRangeValid=!(reportBounds.start&&reportBounds.end&&reportBounds.start>reportBounds.end);
  const reportSums=useMemo(()=>{
    const inRange=(value:any)=>{const date=String(value||'').slice(0,10);return Boolean(date)&&(!reportBounds.start||date>=reportBounds.start)&&(!reportBounds.end||date<=reportBounds.end);};
    const periodSales=sales.filter(o=>inRange(o.created_at));
    const periodExpenses=expenses.filter(e=>e.status==='Recorded'&&inRange(e.expense_date));
    const periodBills=bills.filter(b=>b.status==='Open'&&inRange(b.bill_date));
    const periodPayments=bills.flatMap(b=>(b.vendor_bill_payments||[]).filter((p:Row)=>!p.reversed_at&&inRange(p.paid_at)));
    return {
      salesSubtotal:periodSales.reduce((sum,o)=>sum+o.subtotal,0),
      estimatedCost:periodSales.reduce((sum,o)=>sum+o.cost,0),
      expenses:periodExpenses.reduce((sum,e)=>sum+num(e.amount),0),
      billTotal:periodBills.reduce((sum,b)=>sum+num(b.subtotal)+num(b.tax_amount)+num(b.shipping_amount),0),
      billPaid:periodPayments.reduce((sum,p)=>sum+num(p.amount),0),
      orderCount:periodSales.length
    };
  },[sales,expenses,bills,reportBounds.start,reportBounds.end]);
  // Category totals follow the same inclusive reporting dates as the financial summary.
  // Only recorded expenses count; voided expenses remain in history but not in totals.
  const expenseCategoryTotals=useMemo(()=>{
    const inRange=(value:any)=>{const date=String(value||'').slice(0,10);return Boolean(date)&&(!reportBounds.start||date>=reportBounds.start)&&(!reportBounds.end||date<=reportBounds.end);};
    const totals=new Map<string,{count:number,amount:number}>();
    for(const expense of expenses){
      if(expense.status!=='Recorded'||!inRange(expense.expense_date))continue;
      const category=String(expense.category||'Uncategorized').trim()||'Uncategorized';
      const previous=totals.get(category)||{count:0,amount:0};
      totals.set(category,{count:previous.count+1,amount:previous.amount+num(expense.amount)});
    }
    return [...totals.entries()].map(([category,values])=>({category,...values})).sort((a,b)=>b.amount-a.amount||a.category.localeCompare(b.category));
  },[expenses,reportBounds.start,reportBounds.end]);
  const profitabilityOrders=useMemo(()=>{
    const inRange=(value:any)=>{const date=String(value||'').slice(0,10);return Boolean(date)&&(!reportBounds.start||date>=reportBounds.start)&&(!reportBounds.end||date<=reportBounds.end);};
    return sales.filter(o=>inRange(o.created_at)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  },[sales,reportBounds.start,reportBounds.end]);
  // Trailing twelve calendar months, including the current partial month.
  // Uses the same order-date and expense-date recognition rules as Financial Reports.
  const monthlyPerformance=useMemo(()=>{
    const now=new Date();
    const months=Array.from({length:12},(_,i)=>{
      const date=new Date(now.getFullYear(),now.getMonth()-11+i,1);
      const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      return {key,label:date.toLocaleDateString('en-US',{month:'short',year:'2-digit'}),revenue:0,cost:0,expenses:0,orders:0};
    });
    const byMonth=new Map(months.map(m=>[m.key,m]));
    for(const order of sales){
      const month=byMonth.get(String(order.created_at||'').slice(0,7));
      if(month){month.revenue+=num(order.subtotal);month.cost+=num(order.cost);month.orders+=1;}
    }
    for(const expense of expenses){
      if(expense.status!=='Recorded')continue;
      const month=byMonth.get(String(expense.expense_date||'').slice(0,7));
      if(month)month.expenses+=num(expense.amount);
    }
    return months.map(m=>({...m,grossProfit:m.revenue-m.cost,operatingProfit:m.revenue-m.cost-m.expenses,margin:m.revenue>0?(m.revenue-m.cost-m.expenses)/m.revenue*100:null}));
  },[sales,expenses]);
  const monthlyChart=useMemo(()=>{
    const values=monthlyPerformance.flatMap(m=>[m.revenue,m.operatingProfit]);
    const max=Math.max(0,...values),min=Math.min(0,...values);
    const top=max===min?max+1:max, bottom=max===min?min-1:min;
    const x=(i:number)=>60+i*75;
    const y=(value:number)=>18+(top-value)/(top-bottom)*182;
    const line=(key:'revenue'|'operatingProfit')=>monthlyPerformance.map((m,i)=>`${x(i)},${y(m[key])}`).join(' ');
    return {x,y,line,zero:y(0),min:bottom,max:top};
  },[monthlyPerformance]);
 const filteredSales=sales.filter(o=>[o.order_number,o.customers?.name].some(x=>String(x||'').toLowerCase().includes(search.toLowerCase())));
 const filteredExpenses=expenses.filter(e=>[e.vendor,e.description,e.category].some(x=>String(x||'').toLowerCase().includes(search.toLowerCase())));
 const filteredBills=bills.filter(b=>[b.vendor,b.bill_number].some(x=>String(x||'').toLowerCase().includes(search.toLowerCase())));
 const saveExpense=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(num(expenseForm.amount)<=0){setError('Expense amount must be positive.');return;}setBusy(true);const {error}=await db.from('expenses').insert({...expenseForm,amount:num(expenseForm.amount),payment_method:expenseForm.payment_method||null,reference:expenseForm.reference||null});setBusy(false);if(error){setError(error.message);return;}setNotice('Expense recorded.');setExpenseForm({expense_date:day(),vendor:'',description:'',category:'Software',amount:'',payment_method:'',reference:'',notes:''});await refresh();};
 const voidExpense=async(e:Row)=>{if(!confirm(`Void expense ${money(num(e.amount))} from ${e.vendor}?`))return;const {error}=await db.from('expenses').update({status:'Voided'}).eq('id',e.id);if(error){setError(error.message);return;}setNotice('Expense voided.');await refresh();};
 const saveBill=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(num(billForm.subtotal)<0||num(billForm.tax_amount)<0||num(billForm.shipping_amount)<0){setError('Bill amounts cannot be negative.');return;}setBusy(true);const {error}=await db.from('vendor_bills').insert({...billForm,purchase_order_id:billForm.purchase_order_id||null,due_date:billForm.due_date||null,subtotal:num(billForm.subtotal),tax_amount:num(billForm.tax_amount),shipping_amount:num(billForm.shipping_amount)});setBusy(false);if(error){setError(error.message);return;}setNotice('Vendor bill recorded.');setBillForm({bill_number:'',vendor:'',purchase_order_id:'',bill_date:day(),due_date:'',subtotal:'',tax_amount:'0',shipping_amount:'0',notes:''});await refresh();};
 const payBill=async(b:Row)=>{const outstanding=num(b.subtotal)+num(b.tax_amount)+num(b.shipping_amount)-paidForBill(b);const input=prompt(`Record a payment for ${b.vendor} (remaining ${money(outstanding)}).\nThis records an external payment only; no money is sent.`,outstanding.toFixed(2));if(input===null)return;const amount=Number(input);if(!Number.isFinite(amount)||amount<=0||amount>outstanding+.005){setError('Enter a positive payment no greater than the outstanding balance.');return;}const reference=prompt('Payment reference (optional):','');if(reference===null)return;const {error}=await db.from('vendor_bill_payments').insert({vendor_bill_id:b.id,amount,reference:reference||null});if(error){setError(error.message);return;}setNotice('Vendor payment recorded in ERP (not processed).');await refresh();};
  const reverseBillPayment=async(b:Row,p:Row)=>{
   if(p.reversed_at){setError('This payment has already been reversed.');return;}
   const reason=prompt(`Reverse the ${money(num(p.amount))} payment for bill ${b.bill_number}?\nEnter a reason (required):`,'');
   if(reason===null)return;
   if(!reason.trim()){setError('A reversal reason is required.');return;}
   if(!confirm(`Confirm reversal of ${money(num(p.amount))} on ${b.bill_number}?\nThis only changes ERP records. It does not move money.`))return;
   setBusy(true);setError('');setNotice('');
   try{
    const {error}=await db.rpc('reverse_vendor_bill_payment',{p_payment_id:p.id,p_reason:reason.trim()});
    if(error)throw error;
    await refresh();
    setNotice('Vendor payment reversed in ERP (no money moved).');
   }catch(e:any){setError(e.message||'Unable to reverse vendor payment.');}finally{setBusy(false);}
  };
 const voidBill=async(b:Row)=>{if(activeBillPayments(b).length){setError('Cannot void a bill with active payments. Reverse or reconcile those payments first.');return;}if(!confirm(`Void bill ${b.bill_number}?`))return;const {error}=await db.from('vendor_bills').update({status:'Void'}).eq('id',b.id);if(error){setError(error.message);return;}setNotice('Vendor bill voided.');await refresh();};
 const field=(label:string,value:string,onChange:(v:string)=>void,type='text',required=false)=><label className="field" style={{minWidth:160,flex:'1 1 180px'}}><span>{label}</span><input type={type} required={required} step={type==='number'?'0.01':undefined} min={type==='number'?'0':undefined} value={value} onChange={e=>onChange(e.target.value)}/></label>;
 const metric=(name:string,value:number)=><div className="card"><div className="muted">{name}</div><div className="value">{money(value)}</div></div>;
 const table=(headers:string[],rows:React.ReactNode[],empty:string)=><div className="tableWrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows:<tr><td colSpan={headers.length} className="muted">{empty}</td></tr>}</tbody></table></div>;
 return <section className="panel" style={{marginTop:16}}><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><div><h2>{tab}</h2><p className="muted">E-commerce and rig builds only · Square session sales and payroll excluded</p></div><button className="btn secondary" onClick={()=>void refresh()} disabled={busy}>{busy?'Loading…':'Refresh'}</button></div>
 {error&&<p role="alert" style={{color:'#ff8b8b'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 {(tab==='Sales Accounting Overview'||tab==='Financial Reports')&&<><div className="cards">{metric('Confirmed order value',sums.orderValue)}{metric('Net payments recorded',sums.paid)}{metric('Customer balances due',sums.balance)}{metric('Estimated product gross profit',sums.salesSubtotal-sums.estimatedCost)}{metric('Recorded operating expenses',sums.expenses)}{metric('Vendor bills outstanding',Math.max(0,sums.billTotal-sums.billPaid))}</div><p className="muted">Operational estimates, not a posted general ledger or tax-ready financial statements. Sales include order tax and shipping; estimated product gross profit excludes both. Order costs are estimates, not verified cost of goods sold. Expenses and vendor bills are separate records; avoid entering the same cost twice. No automated journal posting or bank reconciliation is enabled.</p></>}
 {tab==='Payments'&&<><input placeholder="Search order or customer" value={search} onChange={e=>setSearch(e.target.value)}/>{table(['Order','Customer','Date','Type','Method','Reference','Amount'],filteredSales.flatMap(o=>[...(o.payments||[]).map((p:Row)=><tr key={'p'+p.id}><td><button className="btn secondary" onClick={()=>openOrder(o.id)}>{o.order_number}</button></td><td>{o.customers?.name||'—'}</td><td>{String(p.paid_at||'').slice(0,10)}</td><td>Payment</td><td>{p.payment_method||'—'}</td><td>{p.reference||'—'}</td><td>{money(num(p.amount))}</td></tr>),...(o.payment_adjustments||[]).map((a:Row)=><tr key={'a'+a.id}><td><button className="btn secondary" onClick={()=>openOrder(o.id)}>{o.order_number}</button></td><td>{o.customers?.name||'—'}</td><td>{String(a.created_at||'').slice(0,10)}</td><td>{a.adjustment_type}</td><td>—</td><td>—</td><td>-{money(num(a.amount))}</td></tr>)]),'No payments or adjustments recorded.')}</>}
 {tab==='Outstanding Balances'&&<><input placeholder="Search order or customer" value={search} onChange={e=>setSearch(e.target.value)}/>{table(['Order','Customer','Order date','Order total','Net paid','Balance','Action'],filteredSales.filter(o=>o.balance>.005).map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.customers?.name||'—'}</td><td>{String(o.created_at||'').slice(0,10)}</td><td>{money(o.total)}</td><td>{money(o.paid)}</td><td>{money(o.balance)}</td><td><button className="btn secondary" onClick={()=>openOrder(o.id)}>Open invoice</button></td></tr>),'No outstanding customer balances.')}</>}
 {tab==='Expenses'&&<><h3>Record expense</h3><form onSubmit={saveExpense}><div className="row" style={{flexWrap:'wrap'}}>{field('Date',expenseForm.expense_date,v=>setExpenseForm(x=>({...x,expense_date:v})),'date',true)}{field('Vendor',expenseForm.vendor,v=>setExpenseForm(x=>({...x,vendor:v})),'text',true)}{field('Description',expenseForm.description,v=>setExpenseForm(x=>({...x,description:v})),'text',true)}<label className="field">Category<select value={expenseForm.category} onChange={e=>setExpenseForm(x=>({...x,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>{field('Amount ($)',expenseForm.amount,v=>setExpenseForm(x=>({...x,amount:v})),'number',true)}{field('Payment method',expenseForm.payment_method,v=>setExpenseForm(x=>({...x,payment_method:v})))}{field('Reference',expenseForm.reference,v=>setExpenseForm(x=>({...x,reference:v})))}</div><button className="btn" disabled={busy} type="submit">Record expense</button></form><h3>Expense history</h3><input placeholder="Search expenses" value={search} onChange={e=>setSearch(e.target.value)}/>{table(['Date','Vendor','Description','Category','Amount','Status','Action'],filteredExpenses.map(e=><tr key={e.id}><td>{e.expense_date}</td><td>{e.vendor}</td><td>{e.description}</td><td>{e.category}</td><td>{money(num(e.amount))}</td><td>{e.status}</td><td>{e.status==='Recorded'&&<button className="btn secondary" onClick={()=>void voidExpense(e)}>Void</button>}</td></tr>),'No expenses recorded.')}</>}
 {tab==='Vendor Bills'&&<><h3>Record vendor bill</h3><form onSubmit={saveBill}><div className="row" style={{flexWrap:'wrap'}}>{field('Bill number',billForm.bill_number,v=>setBillForm(x=>({...x,bill_number:v})),'text',true)}{field('Vendor',billForm.vendor,v=>setBillForm(x=>({...x,vendor:v})),'text',true)}<label className="field">Purchase order (optional)<select value={billForm.purchase_order_id} onChange={e=>{const id=e.target.value;const po=pos.find(p=>p.id===id);setBillForm(x=>({...x,purchase_order_id:id,vendor:po?.vendor||x.vendor}));}}><option value="">Not linked</option>{pos.map(p=><option key={p.id} value={p.id}>{p.po_number} · {p.vendor}</option>)}</select></label>{field('Bill date',billForm.bill_date,v=>setBillForm(x=>({...x,bill_date:v})),'date',true)}{field('Due date',billForm.due_date,v=>setBillForm(x=>({...x,due_date:v})),'date')}{field('Subtotal ($)',billForm.subtotal,v=>setBillForm(x=>({...x,subtotal:v})),'number',true)}{field('Tax ($)',billForm.tax_amount,v=>setBillForm(x=>({...x,tax_amount:v})),'number')}{field('Shipping ($)',billForm.shipping_amount,v=>setBillForm(x=>({...x,shipping_amount:v})),'number')}</div><button className="btn" type="submit" disabled={busy}>Record bill</button></form><h3>Vendor bills</h3><input placeholder="Search vendor or bill number" value={search} onChange={e=>setSearch(e.target.value)}/>{table(['Bill','Vendor','Due','Total','Paid','Remaining','Status','Action'],filteredBills.flatMap(b=>{const total=num(b.subtotal)+num(b.tax_amount)+num(b.shipping_amount),paid=paidForBill(b),payments:Row[]=b.vendor_bill_payments||[];return [<tr key={b.id}><td>{b.bill_number}</td><td>{b.vendor}</td><td>{b.due_date||'—'}</td><td>{money(total)}</td><td>{money(paid)}</td><td>{money(Math.max(0,total-paid))}</td><td>{b.status}</td><td><div className="row" style={{flexWrap:'wrap'}}><button className="btn secondary" onClick={()=>setExpandedBill(x=>x===b.id?null:b.id)}>{expandedBill===b.id?'Hide payments':`Payments (${payments.length})`}</button>{b.status==='Open'&&<>{total-paid>.005&&<button className="btn secondary" disabled={busy} onClick={()=>void payBill(b)}>Record payment</button>}{activeBillPayments(b).length===0&&<button className="btn secondary" disabled={busy} onClick={()=>void voidBill(b)}>Void</button>}</>}</div></td></tr>,...(expandedBill===b.id?[<tr key={`${b.id}-history`}><td colSpan={8}><strong>Payment history — {b.bill_number}</strong>{payments.length===0?<p className="muted">No payments recorded.</p>:<div className="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Reversal details</th><th>Action</th></tr></thead><tbody>{[...payments].sort((a,c)=>String(c.created_at||'').localeCompare(String(a.created_at||''))).map((p:Row)=><tr key={p.id}><td>{p.paid_at||String(p.created_at||'').slice(0,10)}</td><td>{money(num(p.amount))}</td><td>{p.payment_method||'—'}</td><td>{p.reference||'—'}</td><td>{p.reversed_at?'Reversed':'Recorded'}</td><td>{p.reversed_at?<><div>{String(p.reversed_at).slice(0,19).replace('T',' ')}</div><div>{p.reversal_reason||'—'}</div><div className="muted">By: {p.reversed_by||'—'}</div></>:'—'}</td><td>{!p.reversed_at&&<button className="btn secondary" disabled={busy} onClick={()=>void reverseBillPayment(b,p)}>Reverse payment</button>}</td></tr>)}</tbody></table></div>}</td></tr>]:[])];}),'No vendor bills recorded.')}</>}
 {tab==='Financial Reports'&&<><h3>Monthly financial performance</h3>
    <p className="muted">Last 12 calendar months, including the current month to date. Confirmed rig-build and e-commerce orders only. Revenue excludes tax and shipping; costs are estimates. Only recorded (not voided) operating expenses count. Simulator sessions and payroll are excluded.</p>
    <div className="cards">{metric('Current month revenue',monthlyPerformance[11].revenue)}{metric('Current month estimated gross profit',monthlyPerformance[11].grossProfit)}{metric('Current month recorded expenses',monthlyPerformance[11].expenses)}{metric('Current month estimated operating profit',monthlyPerformance[11].operatingProfit)}</div>
    <p className="muted">Current month estimated operating margin: {monthlyPerformance[11].margin===null?'— (no revenue)':`${monthlyPerformance[11].margin.toFixed(1)}%`}. These are operational estimates, not bank cash flow or formal net income.</p>
    <div className="tableWrap" style={{padding:'12px 4px'}}><svg viewBox="0 0 960 260" role="img" aria-label="Monthly revenue and estimated operating profit over the last twelve months" style={{width:'100%',height:'auto',minWidth:600}}>
      <line x1="48" y1={monthlyChart.zero} x2="915" y2={monthlyChart.zero} stroke="#999" strokeDasharray="4 4"/>
      <polyline points={monthlyChart.line('revenue')} fill="none" stroke="#2878db" strokeWidth="3" strokeLinejoin="round"/>
      <polyline points={monthlyChart.line('operatingProfit')} fill="none" stroke="#20a574" strokeWidth="3" strokeLinejoin="round"/>
      {monthlyPerformance.map((m,i)=><g key={m.key}><circle cx={monthlyChart.x(i)} cy={monthlyChart.y(m.revenue)} r="4" fill="#2878db"><title>{`${m.label} revenue: ${money(m.revenue)}`}</title></circle><circle cx={monthlyChart.x(i)} cy={monthlyChart.y(m.operatingProfit)} r="4" fill="#20a574"><title>{`${m.label} estimated operating profit: ${money(m.operatingProfit)}`}</title></circle><text x={monthlyChart.x(i)} y="222" textAnchor="middle" fontSize="11" fill="currentColor">{m.label}</text></g>)}
      <text x="48" y="12" fontSize="11" fill="currentColor">{money(monthlyChart.max)}</text><text x="48" y="242" fontSize="11" fill="currentColor">{money(monthlyChart.min)}</text>
      <line x1="355" y1="252" x2="380" y2="252" stroke="#2878db" strokeWidth="3"/><text x="385" y="256" fontSize="12" fill="currentColor">Revenue</text><line x1="485" y1="252" x2="510" y2="252" stroke="#20a574" strokeWidth="3"/><text x="515" y="256" fontSize="12" fill="currentColor">Estimated operating profit</text>
    </svg></div>
    {table(['Month','Orders','Revenue','Estimated product costs','Gross profit','Recorded expenses','Estimated operating profit','Operating margin'],monthlyPerformance.map(m=><tr key={m.key}><td>{m.label}</td><td>{m.orders}</td><td>{money(m.revenue)}</td><td>{money(m.cost)}</td><td>{money(m.grossProfit)}</td><td>{money(m.expenses)}</td><td>{money(m.operatingProfit)}</td><td>{m.margin===null?'—':`${m.margin.toFixed(1)}%`}</td></tr>),'No monthly data available.')}
    <p className="muted">Monthly dashboard always shows the trailing 12 months. The reporting-period selector below applies to the detailed financial summary and order profitability table, not this dashboard. Order figures use creation dates; expenses use expense dates. Vendor bills are not deducted separately to avoid potential double counting.</p>
    <h3>Operational financial summary</h3>
    <div className="row" style={{flexWrap:'wrap',alignItems:'end',gap:12}}>
      <label className="field"><span>Reporting period</span><select value={reportPeriod} onChange={e=>setReportPeriod(e.target.value as typeof reportPeriod)}><option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="thisQuarter">This quarter</option><option value="thisYear">This year</option><option value="all">All time</option><option value="custom">Custom range</option></select></label>
      {reportPeriod==='custom'&&<><label className="field"><span>From</span><input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></label><label className="field"><span>Through</span><input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></label></>}
    </div>
    <p className="muted">{reportBounds.start||'Beginning'} through {reportBounds.end||'latest available'} · Dates are inclusive</p>
    {!reportRangeValid?<p role="alert" style={{color:'#ff8b8b'}}>The start date must not be after the end date.</p>:<>{table(['Metric','Amount'],[['Sales subtotal (excluding tax and shipping)',reportSums.salesSubtotal],['Estimated item costs',reportSums.estimatedCost],['Estimated product gross profit',reportSums.salesSubtotal-reportSums.estimatedCost],['Recorded operating expenses',reportSums.expenses],['Illustrative margin after expenses',reportSums.salesSubtotal-reportSums.estimatedCost-reportSums.expenses],['Open vendor bills dated in period',reportSums.billTotal],['Active vendor payments dated in period',reportSums.billPaid]].map(([name,value])=><tr key={String(name)}><td>{name}</td><td>{money(Number(value))}</td></tr>),'No data') }<p className="muted">{reportSums.orderCount} confirmed orders created in this period. Sales and estimated costs are assigned to the order creation date, not the payment or fulfillment date. Expenses use expense date; open vendor bills use bill date; active vendor payments use paid date, including payments on bills from other periods. Reversed payments are excluded based on current reversal status.</p></>}
     {reportRangeValid&&<><h3>Sales order profitability</h3>
       <p className="muted">Orders created in the selected reporting period. Revenue and estimated costs exclude tax and shipping. Profit is an estimate before operating expenses, payment fees, and any unallocated build labor. Payment status is based on recorded net payments.</p>
       {table(['Order','Customer','Date','Revenue','Estimated cost','Gross profit','Margin','Net paid','Balance','Payment status','Action'],profitabilityOrders.map(o=>{const profit=o.subtotal-o.cost;const margin=o.subtotal>0?profit/o.subtotal*100:null;const paymentStatus=o.balance<=.005?'Paid':o.paid>.005?'Partially paid':'Unpaid';return <tr key={o.id}><td>{o.order_number}</td><td>{o.customers?.name||'—'}</td><td>{String(o.created_at||'').slice(0,10)}</td><td>{money(o.subtotal)}</td><td>{money(o.cost)}</td><td>{money(profit)}</td><td>{margin===null?'—':`${margin.toFixed(1)}%`}</td><td>{money(o.paid)}</td><td>{money(o.balance)}</td><td>{paymentStatus}</td><td><button className="btn secondary" onClick={()=>openOrder(o.id)}>Open order</button></td></tr>;}),'No confirmed sales orders in this reporting period.')}
       <h3>Operating expenses by category</h3>
       {table(['Category','Recorded expenses','Total amount'],expenseCategoryTotals.map(item=><tr key={item.category}><td>{item.category}</td><td>{item.count}</td><td>{money(item.amount)}</td></tr>).concat(expenseCategoryTotals.length?[<tr key="category-total"><td><strong>Total operating expenses</strong></td><td><strong>{expenseCategoryTotals.reduce((sum,item)=>sum+item.count,0)}</strong></td><td><strong>{money(expenseCategoryTotals.reduce((sum,item)=>sum+item.amount,0))}</strong></td></tr>]:[]),'No recorded expenses in this reporting period.')}
       <p className="muted">Only recorded (not voided) expenses dated within the selected period are included. Categories reflect the expense records as saved.</p>
     </>}
    <p className="muted">Illustrative margin is not net income or a formal period Profit &amp; Loss statement. Vendor bills may overlap order item costs or recorded expenses and are not subtracted again. Inventory recognition, tax liability, historical as-of balances, and posted double-entry accounting require a later reconciliation phase.</p></>}
 </section>;
}
