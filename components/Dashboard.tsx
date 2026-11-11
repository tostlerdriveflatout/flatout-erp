'use client';

import AccountingWorkspace from './Account/AccountingWorkspace';
import {useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase-browser';
import {useRouter} from 'next/navigation';
type Customer={
  id:string,
  name:string,
  
  company:string|null,
  email:string|null,
  phone:string|null,
  billing_address:string|null,
  shipping_address:string|null,
  notes:string|null
}; 
type Employee={
  id:string,
  user_id:string|null,
  name:string,
  email:string|null,
  phone:string|null,
  role:'Admin'|'Manager'|'Employee'|'Technician',
  erp_access:boolean,
  active:boolean,
  job_title:string|null,
  notes:string|null,
  invite_status:'pending'|'active'|null,
account_activated_at:string|null,
  created_at:string,
  updated_at:string
};  
type Product={id:string,sku:string|null,name:string,vendor:string|null,category:string|null,sell_price:number,cost:number|null,active:boolean};type Payment={id:string,order_id:string,amount:number,payment_method:string|null,reference:string|null,notes:string|null,paid_at:string};
type PaymentAdjustment={id:string,payment_id:string,order_id:string,adjustment_type:'Refund'|'Void',amount:number,reason:string,square_reference:string|null,created_at:string};
type Order={
  id:string,
  order_number:string,
  status:string,
  payment_status:string,
  tax_rate:number,
  shipping_amount:number,
  tax_exempt:boolean,
  customer_id:string,
  shipping_address:string|null,
  reference_number:string|null,
  created_at?:string,
  order_date?:string|null,
  customers?:Customer,
  order_items?:Item[],
  payments?:Payment[],
   payment_adjustments?:PaymentAdjustment[],
  order_notes?:OrderNote[]
};
type PurchaseOrderItem={id:string,purchase_order_id:string,order_item_id:string|null,description:string,sku:string|null,qty:number,unit_cost:number|null,sort_order:number};type PurchaseOrder={id:string,po_number:string,order_id:string,vendor:string,notes:string|null,status:string,created_at:string,purchase_order_items?:PurchaseOrderItem[],orders?:Order};type OrderNote={id:string,order_id:string,note:string,created_at:string,created_by:string|null};type Item={id:string,order_id:string,product_id:string|null,item_type:string,description:string,sku:string|null,vendor:string|null,qty:number,sell_price:number,cost:number|null,purchasing_status:string,tracking:string|null,notes:string|null,vendor_order_number:string|null,eta_date:string|null,purchasing_notes:string|null};
type Build = {
  id: string,
  order_id: string,
  build_number: string,
  name: string | null,
  status:
    | 'Not Started'
    | 'Waiting for Parts'
    | 'Ready to Build'
    | 'Building'
    | 'Build Complete'
    | 'Ready for Installation'
    | 'Installing'
    | 'Completed',
  assigned_technician_id: string | null,
  build_notes: string | null,
  installation_notes: string | null,
  installation_date: string | null,
  canceled_at: string | null,
  created_at: string,
  updated_at: string
};
type BuildItem = {
  id: string,
  build_id: string,
  order_item_id: string,
  qty: number,
  created_at: string,
  updated_at: string
};
// A date-only database value is a calendar day, not a UTC timestamp.
function buildDateValue(value:string|null|undefined){
  if(!value)return '';
  const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match?`${match[1]}-${match[2]}-${match[3]}`:'';
}
function displayBuildDate(value:string|null|undefined){
  const day=buildDateValue(value);
  if(!day)return '—';
  const [year,month,date]=day.split('-');
  return `${month}/${date}/${year}`;
}
// Print a technician-only sheet for the selected build. Do not include pricing or unassigned order items.
function printTechnicianBuildSheet(build:Build,order:Order|undefined,technician:string,assigned:BuildItem[]){
  const popup=window.open('','_blank');
  if(!popup){window.alert('Please allow pop-ups for this site to print the build sheet.');return;}
  const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));
  const items=assigned.filter(bi=>bi.build_id===build.id&&Number(bi.qty)>0).map(bi=>{
    const item=order?.order_items?.find(i=>i.id===bi.order_item_id);
    return item?{description:item.description,sku:item.sku||'—',vendor:item.vendor||'—',qty:bi.qty}:null;
  }).filter((item):item is {description:string,sku:string,vendor:string,qty:number}=>item!==null);
  const rows=items.length?items.map(item=>`<tr><td class="check">&#9633;</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.sku)}</td><td>${escapeHtml(item.vendor)}</td><td class="qty">${escapeHtml(item.qty)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No parts have been assigned to this build.</td></tr>';
  const note=(value:string|null)=>value?.trim()?escapeHtml(value).replace(/\r?\n/g,'<br>'):'<span class="muted">No notes entered</span>';
  const logoUrl=escapeHtml(new URL('/flatout-logo.svg',window.location.origin).href);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Build Sheet - ${escapeHtml(build.build_number)}</title><style>
    @page{size:letter;margin:0.55in}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#161616;margin:0;font-size:11px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:3px solid #e71d36;padding-bottom:12px;margin-bottom:16px}.brand-logo{display:block;width:150px;max-height:58px;height:auto;object-fit:contain;object-position:left center}.heading{text-align:right}.heading h1{font-size:22px;margin:0}.heading div{font-size:11px;margin-top:3px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:9px 20px;padding:14px;background:#f5f5f5;border:1px solid #ddd;border-radius:5px;margin-bottom:20px}.meta div{min-width:0}.meta b{display:block;color:#666;font-size:9px;text-transform:uppercase;margin-bottom:3px}.meta span{font-size:12px;font-weight:600;overflow-wrap:anywhere}h2{font-size:13px;background:#111;color:#fff;padding:9px 11px;margin:18px 0 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#eee;font-size:10px;text-align:left}td,th{border:1px solid #d8d8d8;padding:8px 7px;overflow-wrap:anywhere}tr{break-inside:avoid}.check{font-size:19px;text-align:center;width:36px}.qty{text-align:center;width:45px}.empty{text-align:center;color:#777;padding:16px}.notes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px}.note{border:1px solid #ddd;border-radius:4px;min-height:86px;padding:10px;overflow-wrap:anywhere;line-height:1.5;break-inside:avoid}.note b{display:block;margin-bottom:8px}.muted{color:#777}.signoff{display:flex;gap:24px;margin-top:30px}.signoff div{flex:1;border-top:1px solid #777;padding-top:6px;font-size:10px;color:#555}.toolbar{padding:12px 0;margin-bottom:12px;display:flex;gap:8px}.toolbar button{border:0;border-radius:4px;padding:10px 14px;background:#111;color:#fff;font-weight:700;cursor:pointer}@media print{.toolbar{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media(max-width:600px){.notes{grid-template-columns:1fr}.meta{grid-template-columns:1fr 1fr}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div><header><img class="brand-logo" src="${logoUrl}" alt="Flatout Sim Racing"/><div class="heading"><h1>BUILD SHEET</h1><div>${escapeHtml(build.build_number)}</div></div></header><section class="meta"><div><b>Sales Order</b><span>${escapeHtml(order?.order_number||'—')}</span></div><div><b>Build Name</b><span>${escapeHtml(build.name||'—')}</span></div><div><b>Customer</b><span>${escapeHtml(order?.customers?.name||'—')}</span></div><div><b>Technician</b><span>${escapeHtml(technician)}</span></div><div><b>Installation Date</b><span>${escapeHtml(displayBuildDate(build.installation_date))}</span></div><div><b>Build Status</b><span>${escapeHtml(build.canceled_at?'Canceled':build.status)}</span></div></section><h2>PARTS CHECKLIST (${items.length} ITEMS)</h2><table><thead><tr><th style="width:36px">&#10003;</th><th>Item / Description</th><th style="width:22%">SKU</th><th style="width:20%">Vendor</th><th style="width:45px;text-align:center">Qty</th></tr></thead><tbody>${rows}</tbody></table><section class="notes"><div class="note"><b>Build Notes</b>${note(build.build_notes)}</div><div class="note"><b>Installation Notes</b>${note(build.installation_notes)}</div></section><section class="signoff"><div>Technician Signature</div><div>Date Completed</div></section></body></html>`;
  popup.document.open();popup.document.write(html);popup.document.close();popup.focus();
}
type ChecklistProgress={id:string,build_id:string,task_key:string,completed:boolean,completed_at:string|null,completed_by:string|null};
const assemblyTasks=[
 ['assembly:chassis','Chassis assembled and secured'],
 ['assembly:hardware','Seat, wheelbase, pedals and displays mounted'],
 ['assembly:cables','Power and cable management completed'],
 ['assembly:software','PC, drivers and simulator software configured'],
 ['assembly:calibration','Steering, pedals and displays calibrated'],
 ['assembly:test','Full simulator functionality tested']
] as const;
function TechnicianChecklist({build,order,assigned,progress,onToggle,saving}:{build:Build,order:Order|undefined,assigned:BuildItem[],progress:ChecklistProgress[],onToggle:(key:string,completed:boolean)=>Promise<void>,saving:string|null}){
 const [stage,setStage]=useState<'parts'|'assembly'>('parts');
 const parts=assigned.filter(b=>b.build_id===build.id&&Number(b.qty)>0).map(b=>({assignment:b,item:order?.order_items?.find(i=>i.id===b.order_item_id)})).filter(x=>!!x.item);
 const tasks=stage==='parts'?parts.map(x=>({key:`part:${x.assignment.id}`,label:x.item!.description,detail:`SKU: ${x.item!.sku||'—'} · Qty: ${x.assignment.qty}`})):assemblyTasks.map(([key,label])=>({key,label,detail:''}));
 const allKeys=[...parts.map(x=>`part:${x.assignment.id}`),...assemblyTasks.map(([key])=>key)];
 const done=allKeys.filter(key=>progress.some(p=>p.task_key===key&&p.completed)).length;
 return <div className="panel" style={{padding:16,marginTop:18}}>
  <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap'}}><h2 style={{border:0,padding:0}}>Technician Checklist</h2><b>{done} / {allKeys.length} complete</b></div>
  <div style={{height:9,background:'#eee',borderRadius:6,overflow:'hidden',margin:'12px 0 16px'}}><div style={{height:'100%',width:`${allKeys.length?done/allKeys.length*100:0}%`,background:'#e71d36'}}/></div>
  <div className="row" style={{flexWrap:'wrap',marginBottom:14}}><button type="button" className={`btn ${stage==='parts'?'':'secondary'}`} onClick={()=>setStage('parts')}>1. Verify Parts</button><button type="button" className={`btn ${stage==='assembly'?'':'secondary'}`} onClick={()=>setStage('assembly')}>2. Assembly & Testing</button></div>
  {stage==='parts'&&<p className="muted">Verify each assigned part and its quantity before checking it off. Progress is saved for the whole team.</p>}
  {tasks.length===0&&<p className="muted">No parts are assigned to this build yet.</p>}
  <div style={{display:'grid',gap:9}}>{tasks.map(t=>{const completed=!!progress.find(p=>p.task_key===t.key)?.completed;return <label key={t.key} style={{display:'flex',gap:12,alignItems:'center',border:'1px solid #dce0d9',borderRadius:7,padding:12,cursor:build.canceled_at?'not-allowed':'pointer'}}><input type="checkbox" style={{width:20,height:20,flexShrink:0}} checked={completed} disabled={!!build.canceled_at||saving===t.key} onChange={e=>void onToggle(t.key,e.target.checked)}/><span style={{minWidth:0}}><b style={{fontSize:14}}>{t.label}</b>{t.detail&&<div className="muted" style={{fontSize:12}}>{t.detail}</div>}</span>{saving===t.key&&<span className="muted">Saving…</span>}</label>})}</div>
  <div className="row" style={{marginTop:14,flexWrap:'wrap'}}>{stage==='parts'?<button type="button" className="btn secondary" onClick={()=>setStage('assembly')}>Continue to Assembly →</button>:<button type="button" className="btn secondary" onClick={()=>setStage('parts')}>← Back to Parts</button>}{done===allKeys.length&&allKeys.length>0&&<span style={{color:'#15803d',fontWeight:700}}>✓ Checklist complete</span>}</div>
  {build.canceled_at&&<p className="muted">Canceled builds are read-only.</p>}
 </div>
}
const LIST_PAGE_SIZE=50;
function ListPagination({page,onPageChange,total,pageSize=LIST_PAGE_SIZE}: {page:number,onPageChange:(page:number)=>void,total:number,pageSize?:number}){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const current=Math.min(Math.max(1,page),pages);
  return <div className="row" style={{justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginTop:14}}>
    <span className="muted">{total===0?'0 results':`${(current-1)*pageSize+1}–${Math.min(current*pageSize,total)} of ${total}`}</span>
    <div className="row" style={{gap:8,alignItems:'center'}}>
      <button type="button" className="btn secondary" disabled={current<=1} onClick={()=>onPageChange(current-1)}>Previous</button>
      <span className="muted">Page {current} of {pages}</span>
      <button type="button" className="btn secondary" disabled={current>=pages} onClick={()=>onPageChange(current+1)}>Next</button>
    </div>
  </div>;
}

const fmtMoney=(n:number)=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
function statusTone(status:string|null|undefined){
  const ok=['Completed','Build Complete','Received','Paid'];
  const info=['Confirmed','Ordered','Shipped','Build Ready','Ready to Build','Building','Ready for Installation','Installing'];
  const warn=['Parts Ordering','Parts Ordered','Waiting for Parts','Need to Order'];
  const bad=['Backordered','Canceled'];
  const v=String(status||'');
  return ok.includes(v)?'ok':info.includes(v)?'info':warn.includes(v)?'warn':bad.includes(v)?'bad':'neutral';
}
function StatusBadge({status}:{status:string|null|undefined}){
  return <span className={`fx-badge fx-${statusTone(status)}`}>{status||'—'}</span>;
}
// Presentation-only styles for the Tier 1 design pass. All class names are prefixed fx- to avoid collisions.
const FX_CSS=`
.fx-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;line-height:1.5;white-space:nowrap}
.fx-badge.fx-ok{background:#dcfce7;color:#14532d}
.fx-badge.fx-info{background:#dbeafe;color:#1e3a8a}
.fx-badge.fx-warn{background:#fef3c7;color:#78350f}
.fx-badge.fx-bad{background:#fee2e2;color:#7f1d1d}
.fx-badge.fx-neutral{background:#e5e7eb;color:#374151}
select.fx-sel-ok{background-color:#dcfce7!important;color:#14532d!important}
select.fx-sel-info{background-color:#dbeafe!important;color:#1e3a8a!important}
select.fx-sel-warn{background-color:#fef3c7!important;color:#78350f!important}
select.fx-sel-bad{background-color:#fee2e2!important;color:#7f1d1d!important}
.fx-num{text-align:right!important;font-variant-numeric:tabular-nums}
.fx-row{cursor:pointer}
.fx-row:hover>td{background:#f3f4f6}
.fx-link{color:#0b5ed7;font-weight:700}
.fx-row:hover .fx-link{text-decoration:underline}
.btn.fx-selected{background:#fff!important;color:#111!important;box-shadow:inset 0 0 0 2px #111!important}
.shell .content{max-width:1600px}
`;

export default function Dashboard({email}:{email:string}){
const s=supabase(),r=useRouter();
const [tab,setTab]=useState('Dashboard');
const [module,setModule]=useState('Sales');
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
// Shared feedback for automatic Supabase writes. Failed saves remain visible.
const [autoSaveStatus,setAutoSaveStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle');
const pendingAutoSaves=useRef(0);
const autoSaveFailed=useRef(false);
const autoSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
function beginAutoSave(){
  if(autoSaveTimer.current)clearTimeout(autoSaveTimer.current);
  pendingAutoSaves.current+=1;
  setAutoSaveStatus(autoSaveFailed.current?'error':'saving');
}
function finishAutoSave(error?:{message:string}|null){
  pendingAutoSaves.current=Math.max(0,pendingAutoSaves.current-1);
  if(error)autoSaveFailed.current=true;
  if(autoSaveFailed.current){setAutoSaveStatus('error');return;}
  if(pendingAutoSaves.current>0){setAutoSaveStatus('saving');return;}
  setAutoSaveStatus('saved');
  autoSaveTimer.current=setTimeout(()=>setAutoSaveStatus('idle'),3000);
}
function retryAutoSaveStatus(){
  // Dismissal clears only the indicator, not any unsaved database change.
  autoSaveFailed.current=false;
  setAutoSaveStatus(pendingAutoSaves.current?'saving':'idle');
}
useEffect(()=>()=>{if(autoSaveTimer.current)clearTimeout(autoSaveTimer.current);},[]);

const historySignature=useRef<string|null>(null);
const historyReady=useRef(false);
const restoringHistory=useRef(false);
const [customers,setCustomers]=useState<Customer[]>([]);
const [employees,setEmployees]=useState<Employee[]>([]);
const [products,setProducts]=useState<Product[]>([]);
const [orders,setOrders]=useState<Order[]>([]);
// Independent history dataset: order-list pagination must not affect the forecast.
const [forecastOrders,setForecastOrders]=useState<Order[]>([]);
const [forecastLoading,setForecastLoading]=useState(false);
const [forecastError,setForecastError]=useState('');
const [forecastSearch,setForecastSearch]=useState('');
const [forecastPage,setForecastPage]=useState(1);
const [buildListPage,setBuildListPage]=useState(1);
const [employeeListPage,setEmployeeListPage]=useState(1);
const [forecastVendor,setForecastVendor]=useState('All');
const [forecastPeriod,setForecastPeriod]=useState('90');
const [forecastUpdated,setForecastUpdated]=useState<Date|null>(null);
const [analyticsPeriod,setAnalyticsPeriod]=useState('365');
const [analyticsSearch,setAnalyticsSearch]=useState('');
const [analyticsPage,setAnalyticsPage]=useState(1);
const [analyticsSelected,setAnalyticsSelected]=useState<string|null>(null);
const [analyticsDetailPage,setAnalyticsDetailPage]=useState(1);

 const [adjustmentPayment,setAdjustmentPayment]=useState<Payment|null>(null);
 const paymentSubmissionInProgress=useRef(false);
 const adjustmentSubmissionInProgress=useRef(false);
const [purchaseOrders,setPurchaseOrders]=useState<PurchaseOrder[]>([]);

const [selected,setSelected]=useState<Order|null>(null);
const [selectedPO,setSelectedPO]=useState<PurchaseOrder|null>(null);
const [editingCustomer,setEditingCustomer]=useState<Customer|null>(null);
const [editingEmployee,setEditingEmployee]=useState<Employee|null>(null);
const [quickCustomerOpen,setQuickCustomerOpen]=useState(false);
const [quickCustomerSaving,setQuickCustomerSaving]=useState(false);
const [quotationCustomerName,setQuotationCustomerName]=useState('');
const [quotationCustomerId,setQuotationCustomerId]=useState('');


const [modal,setModal]=useState('');
const [search,setSearch]=useState('');
const [orderSearch,setOrderSearch]=useState('');
const [orderStatusFilter,setOrderStatusFilter]=useState('All');
const [orderPage,setOrderPage]=useState(1);
const [orderTotal,setOrderTotal]=useState(0);

const ORDERS_PER_PAGE = 50;
  const [customerSearch,setCustomerSearch]=useState('');
const [customerPage,setCustomerPage]=useState(1);
const [customerTotal,setCustomerTotal]=useState(0);

const CUSTOMERS_PER_PAGE = 50;
  const [productSearch,setProductSearch]=useState('');
const [productCategoryFilter,setProductCategoryFilter]=useState('All');
const [productPage,setProductPage]=useState(1);
const [productTotal,setProductTotal]=useState(0);
  
const PRODUCTS_PER_PAGE = 50;
const [builds,setBuilds]=useState<Build[]>([])
const [buildFilter,setBuildFilter]=useState<'Active'|'Canceled'|'All'>('Active')
const [buildScope,setBuildScope]=useState<'Mine'|'All'>('All')
const [buildSummary,setBuildSummary]=useState<ChecklistProgress[]>([])
const [showCancelBuildConfirm,setShowCancelBuildConfirm]=useState(false)
const [buildItems,setBuildItems]=useState<BuildItem[]>([])
const [checklistProgress,setChecklistProgress]=useState<ChecklistProgress[]>([]);
const [checklistSaving,setChecklistSaving]=useState<string|null>(null);                                                          
const [selectedBuild,setSelectedBuild]=useState<Build|null>(null)
useEffect(()=>{if(!selectedBuild){setChecklistProgress([]);return;}let active=true;setChecklistProgress([]);(async()=>{const {data,error}=await s.from('build_checklist_progress').select('*').eq('build_id',selectedBuild.id);if(active){if(error)console.error('Checklist load failed',error);else setChecklistProgress((data||[]) as ChecklistProgress[]);}})();return()=>{active=false;};},[selectedBuild?.id]);
async function toggleChecklistTask(key:string,completed:boolean){
 if(!selectedBuild||selectedBuild.canceled_at||checklistSaving)return;
 const buildId=selectedBuild.id;
 setChecklistSaving(key);
 try{
  const {data:{user}}=await s.auth.getUser();
  if(!user){alert('Please sign in again.');return;}
  const {data,error}=await s.from('build_checklist_progress').upsert({build_id:buildId,task_key:key,completed,completed_at:completed?new Date().toISOString():null,completed_by:completed?user.id:null,updated_at:new Date().toISOString()},{onConflict:'build_id,task_key'}).select('*').single();
  if(error){alert('Checklist update failed: '+error.message);return;}
  setChecklistProgress(prev=>[...prev.filter(p=>p.task_key!==key),data as ChecklistProgress]);
  setBuildSummary(prev=>[...prev.filter(p=>!(p.build_id===buildId&&p.task_key===key)),data as ChecklistProgress]);
 }catch(err){console.error(err);alert('Checklist could not be saved.');}finally{setChecklistSaving(null);}
}

const [me,setMe]=useState<Employee|null>(null)
async function load() {
  // First verify the currently logged-in user's employee record.
  const {
    data: { user },
    error: userError
  } = await s.auth.getUser()

  if (userError || !user) {
    await s.auth.signOut()
    r.push('/login')
    return
  }

  const { data: currentEmployee, error: employeeError } =
    await s
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .single()

  // Block anyone who is not an active employee with ERP Access enabled.
  if (
    employeeError ||
    !currentEmployee ||
    !currentEmployee.active ||
    !currentEmployee.erp_access
  ) {
    await s.auth.signOut()
    alert('Your ERP access is currently disabled.')
    r.push('/login')
    return
  }
setMe(currentEmployee as Employee)
  if(currentEmployee.role === 'Technician'){
  setModule('Builds');
  setTab('Dashboard');
}
  // User is authorized — now load the ERP data.
let [c,e,p,o,po,b,bi] = await Promise.all([
  s.from('customers').select('*').order('name'),
  s.from('employees').select('*').order('name'),
  s.from('products').select('*').eq('active',true).order('name'),
  s.from('orders')
    .select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)')
    .order('created_at',{ascending:false}),
  s.from('purchase_orders')
    .select('*,purchase_order_items(*),orders(*,customers(*))')
    .order('created_at',{ascending:false}),
  s.from('builds')
    .select('*')
    .order('created_at',{ascending:false}),
  s.from('build_items')
    .select('*')
    .order('created_at',{ascending:true})
])

  setCustomers((c.data || []) as Customer[])
  setEmployees((e.data || []) as Employee[])
  setProducts((p.data || []) as Product[])
  setOrders((o.data || []) as any)
  setPurchaseOrders((po.data || []) as any)
  setBuilds((b.data || []) as Build[])
  setBuildItems((bi.data||[]) as BuildItem[])
  const {data:summary,error:summaryError}=await s.from('build_checklist_progress').select('id,build_id,task_key,completed,completed_at,completed_by');
  if(summaryError)console.error('Build checklist summary load failed:',summaryError);
  else setBuildSummary((summary||[]) as ChecklistProgress[]);
}

  async function loadOrdersPage(
  page = orderPage,
  searchTerm = orderSearch,
  statusFilter = orderStatusFilter
){
  let query = s
    .from('orders')
    .select(
      '*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)',
      {count:'exact'}
    )
    .order('created_at',{ascending:false});

  if(tab === 'Quotations'){
    query = query.eq('status','Draft');
  } else {
    query = query.neq('status','Draft');
    if(statusFilter !== 'All'){
      query = query.eq('status',statusFilter);
    }
  }

  if(searchTerm.trim()){
    query = query.or(
      `order_number.ilike.%${searchTerm.trim()}%,reference_number.ilike.%${searchTerm.trim()}%`
    );
  }

  const from = (page - 1) * ORDERS_PER_PAGE;
  const to = from + ORDERS_PER_PAGE - 1;

  const {data,count,error} = await query.range(from,to);

  if(error){
    console.error('Order search error:',error);
    return;
  }

  setOrders((data || []) as any);
  setOrderTotal(count || 0);
}
  async function loadCustomersPage(
  page = customerPage,
  searchTerm = customerSearch
){
  let query = s
    .from('customers')
    .select('*',{count:'exact'})
    .order('name',{ascending:true});

  if(searchTerm.trim()){
    const term = searchTerm.trim();

    query = query.or(
      `name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  const from = (page - 1) * CUSTOMERS_PER_PAGE;
  const to = from + CUSTOMERS_PER_PAGE - 1;

  const {data,count,error} = await query.range(from,to);

  if(error){
    console.error('Customer search error:',error);
    return;
  }

setCustomers((data || []) as Customer[]);
setCustomerTotal(count || 0);
}

async function loadProductsPage(
  page = productPage,
  searchTerm = productSearch,
  categoryFilter = productCategoryFilter
){
  let query = s
    .from('products')
    .select('*',{count:'exact'})
    .eq('active',true)
    .order('name',{ascending:true});

  if(searchTerm.trim()){
    const term = searchTerm.trim();

    query = query.or(
      `name.ilike.%${term}%,sku.ilike.%${term}%,vendor.ilike.%${term}%,category.ilike.%${term}%`
    );
  }

  if(categoryFilter !== 'All'){
    query = query.eq('category',categoryFilter);
  }

  const from = (page - 1) * PRODUCTS_PER_PAGE;
  const to = from + PRODUCTS_PER_PAGE - 1;

  const {data,count,error} = await query.range(from,to);

  if(error){
    console.error('Product search error:',error);
    return;
  }

  setProducts((data || []) as Product[]);
  setProductTotal(count || 0);
}

useEffect(()=>{
  load();
},[])
// Read-only reporting; no inventory movements or stock quantities are inferred.
async function loadForecast(){
  setForecastLoading(true);setForecastError('');
  try{
    const collected:Order[]=[];
    const batch=500;
    for(let offset=0;;offset+=batch){
      const {data,error}=await s.from('orders')
        .select('id,order_number,status,order_date,created_at,order_items(id,product_id,item_type,description,sku,vendor,qty,sell_price,cost)')
        .neq('status','Draft').order('created_at',{ascending:false}).range(offset,offset+batch-1);
      if(error)throw error;
      const page=(data||[]) as unknown as Order[];
      collected.push(...page);
      if(page.length<batch)break;
    }
    setForecastOrders(collected);setForecastUpdated(new Date());
  }catch(error){setForecastError(error instanceof Error?error.message:'Unable to load sales history.');}
  finally{setForecastLoading(false);}
}
useEffect(()=>{if(module==='Inventory'&&['Inventory Forecast','Product Analytics','Vendor Analytics'].includes(tab))void loadForecast();},[module,tab]);
const forecastRows=useMemo(()=>{
  const grouped=new Map<string,{key:string,sku:string,name:string,vendor:string,category:string,total:number,revenue:number,last30:number,last90:number,last365:number,period:number,months:Record<string,number>}>();
  const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const daysSince=(raw:string)=>Math.floor((today.getTime()-new Date(raw+'T12:00:00').getTime())/86400000);
  for(const order of forecastOrders){
    // Exclude explicitly canceled orders, as well as quotations.
    if(/cancelled|canceled/i.test(order.status))continue;
    const date=(order.order_date||order.created_at||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const age=daysSince(date);if(!Number.isFinite(age)||age<0)continue;
    for(const item of order.order_items||[]){
      if(item.item_type!=='Product')continue;
      const qty=Number(item.qty);if(!Number.isFinite(qty)||qty<=0)continue;
      const key=item.product_id?`id:${item.product_id}`:item.sku?.trim()?`sku:${item.sku.trim().toLowerCase()}`:`name:${item.description.trim().toLowerCase()}`;
      let row=grouped.get(key);
      if(!row){row={key,sku:item.sku||'—',name:item.description,vendor:item.vendor||'—',category:'—',total:0,revenue:0,last30:0,last90:0,last365:0,period:0,months:{}};grouped.set(key,row);}
      row.total+=qty;row.revenue+=qty*Number(item.sell_price||0);
      if(age<30)row.last30+=qty;if(age<90)row.last90+=qty;if(age<365)row.last365+=qty;
      if(age<Number(forecastPeriod))row.period+=qty;
      const month=date.slice(0,7);row.months[month]=(row.months[month]||0)+qty;
    }
  }
  return [...grouped.values()].map(row=>({...row,monthly:row.last90/3,forecast30:row.last90/3,forecast90:row.last90})).sort((a,b)=>b.period-a.period||a.name.localeCompare(b.name));
},[forecastOrders,forecastPeriod]);

useEffect(()=>{
  if(tab !== 'Orders' && tab !== 'Quotations') return;

  const timer = setTimeout(()=>{
    loadOrdersPage(
      orderPage,
      orderSearch,
      orderStatusFilter
    );
  },300);

  return ()=>clearTimeout(timer);
},[tab,orderPage,orderSearch,orderStatusFilter]);

useEffect(()=>{
  if(tab !== 'Customers') return;

  const timer = setTimeout(()=>{
    loadCustomersPage(
      customerPage,
      customerSearch
    );
  },300);

  return ()=>clearTimeout(timer);
},[tab,customerPage,customerSearch]);

  useEffect(()=>{
  if(tab !== 'Products') return;

  const timer = setTimeout(()=>{
    loadProductsPage(
      productPage,
      productSearch,
      productCategoryFilter
    );
  },300);

  return ()=>clearTimeout(timer);
},[tab,productPage,productSearch,productCategoryFilter]);
 // Keep ERP navigation in browser history without changing the Next.js page route.
 // Query parameters also let a bookmarked view survive a refresh.
 useEffect(()=>{
   if(!me || historyReady.current)return;
   historyReady.current=true;
   restoringHistory.current=true;
   const params=new URLSearchParams(window.location.search);
   const requestedModule=params.get('erpModule');
   const requestedTab=params.get('erpTab');
   const allowedModules=me.role==='Admin'
     ? ['Sales','Purchases','Builds','Inventory','Accounting','Employees']
     : me.role==='Technician' ? ['Builds'] : ['Sales','Purchases','Builds','Inventory'];
   const defaults:Record<string,string>={Sales:'Dashboard',Purchases:'Purchasing',Builds:'Builds',Inventory:'Inventory Forecast',Accounting:'Sales Accounting Overview',Employees:'Employees'};
   const allowedTabs:Record<string,string[]>={
     Sales:['Dashboard','Customers','Quotations','Orders','Products','Order','Quote','Invoice'],
     Purchases:['Purchasing','Purchase Orders','Products','Purchase Order','Order'],
     Builds:['Builds','Build'],Inventory:['Inventory Forecast','Product Analytics','Vendor Analytics','Products'],
     Accounting:['Sales Accounting Overview','Payments','Outstanding Balances','Expenses','Vendor Bills','Financial Reports','Invoice'],
     Employees:['Employees']
   };
   const initialModule=requestedModule && allowedModules.includes(requestedModule)?requestedModule:(me.role==='Technician'?'Builds':'Sales');
   const initialTab=requestedTab && allowedTabs[initialModule]?.includes(requestedTab)?requestedTab:defaults[initialModule];
   const id=params.get('erpId');
   const kind=params.get('erpKind');
   const initialSignature=JSON.stringify([initialModule,initialTab,id||'',kind||'']);
   historySignature.current=initialSignature;
   const initialUrl=new URL(window.location.href);
   initialUrl.searchParams.set('erpModule',initialModule);
   initialUrl.searchParams.set('erpTab',initialTab);
   if(!id){initialUrl.searchParams.delete('erpId');initialUrl.searchParams.delete('erpKind');}
   window.history.replaceState({flatoutErp:true},'',initialUrl.pathname+initialUrl.search+initialUrl.hash);
   setModule(initialModule);
   setTab(initialTab);
   const restore=async()=>{
     if(!id)return;
     if(kind==='order' && ['Order','Quote','Invoice'].includes(initialTab)){
       const {data}=await s.from('orders').select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)').eq('id',id).single();
       if(data)setSelected(data as Order);
       else setTab(initialModule==='Accounting'?'Sales Accounting Overview':'Orders');
     }else if(kind==='po' && initialTab==='Purchase Order'){
       const {data}=await s.from('purchase_orders').select('*,purchase_order_items(*),orders(*,customers(*))').eq('id',id).single();
       if(data)setSelectedPO(data as PurchaseOrder);
       else setTab('Purchase Orders');
     }else if(kind==='build' && initialTab==='Build'){
       const {data}=await s.from('builds').select('*').eq('id',id).single();
       if(data)setSelectedBuild(data as Build);
       else setTab('Builds');
     }
   };
   void restore().finally(()=>{setTimeout(()=>{restoringHistory.current=false;},0);});
 },[me]);

 useEffect(()=>{
   if(!historyReady.current || !me || restoringHistory.current)return;
   const kind=['Order','Quote','Invoice'].includes(tab)&&selected?'order':tab==='Purchase Order'&&selectedPO?'po':tab==='Build'&&selectedBuild?'build':'';
   const id=kind==='order'?selected!.id:kind==='po'?selectedPO!.id:kind==='build'?selectedBuild!.id:'';
   const signature=JSON.stringify([module,tab,id,kind]);
   if(signature===historySignature.current)return;
   historySignature.current=signature;
   const url=new URL(window.location.href);
   url.searchParams.set('erpModule',module);
   url.searchParams.set('erpTab',tab);
   if(id){url.searchParams.set('erpId',id);url.searchParams.set('erpKind',kind);}
   else {url.searchParams.delete('erpId');url.searchParams.delete('erpKind');}
   window.history.pushState({flatoutErp:true},'',url.pathname+url.search+url.hash);
 },[module,tab,selected?.id,selectedPO?.id,selectedBuild?.id,me]);

 useEffect(()=>{
   if(!me)return;
   const onBackForward=async()=>{
     restoringHistory.current=true;
     const params=new URLSearchParams(window.location.search);
     const requestedModule=params.get('erpModule');
     const allowedModules=me.role==='Admin'?['Sales','Purchases','Builds','Inventory','Accounting','Employees']:
       me.role==='Technician'?['Builds']:['Sales','Purchases','Builds','Inventory'];
     const nextModule=requestedModule&&allowedModules.includes(requestedModule)?requestedModule:(me.role==='Technician'?'Builds':'Sales');
     const defaults:Record<string,string>={Sales:'Dashboard',Purchases:'Purchasing',Builds:'Builds',Inventory:'Inventory Forecast',Accounting:'Sales Accounting Overview',Employees:'Employees'};
     const allowedTabs:Record<string,string[]>={Sales:['Dashboard','Customers','Quotations','Orders','Products','Order','Quote','Invoice'],Purchases:['Purchasing','Purchase Orders','Products','Purchase Order','Order'],Builds:['Builds','Build'],Inventory:['Inventory Forecast','Product Analytics','Vendor Analytics','Products'],Accounting:['Sales Accounting Overview','Payments','Outstanding Balances','Expenses','Vendor Bills','Financial Reports','Invoice'],Employees:['Employees']};
     const requestedTab=params.get('erpTab');
     const nextTab=requestedTab&&allowedTabs[nextModule]?.includes(requestedTab)?requestedTab:defaults[nextModule];
     const id=params.get('erpId')||'';
     const kind=params.get('erpKind')||'';
     historySignature.current=JSON.stringify([nextModule,nextTab,id,kind]);
     setModule(nextModule);setTab(nextTab);
     setSelected(null);setSelectedPO(null);setSelectedBuild(null);
     if(!id){setTimeout(()=>{restoringHistory.current=false;},0);return;}
     if(kind==='order'&&['Order','Quote','Invoice'].includes(nextTab)){
       const {data}=await s.from('orders').select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)').eq('id',id).single();
       if(data)setSelected(data as Order);
     }else if(kind==='po'&&nextTab==='Purchase Order'){
       const {data}=await s.from('purchase_orders').select('*,purchase_order_items(*),orders(*,customers(*))').eq('id',id).single();
       if(data)setSelectedPO(data as PurchaseOrder);
     }else if(kind==='build'&&nextTab==='Build'){
       const {data}=await s.from('builds').select('*').eq('id',id).single();
       if(data)setSelectedBuild(data as Build);
     }
     setTimeout(()=>{restoringHistory.current=false;},0);
   };
   window.addEventListener('popstate',onBackForward);
   return()=>window.removeEventListener('popstate',onBackForward);
 },[me]);

const confirmedOrders=orders.filter(o=>o.status!=='Draft');const need=confirmedOrders.flatMap(o=>(o.order_items||[]).filter(i=>i.item_type==='Product'&&i.purchasing_status!=='Received'));const totals=(o:Order)=>{let sell=(o.order_items||[]).reduce((a,i)=>a+i.qty*Number(i.sell_price),0),cost=(o.order_items||[]).reduce((a,i)=>a+i.qty*Number(i.cost||0),0);return {sell,cost,gp:sell-cost,gm:sell?((sell-cost)/sell*100):0}};async function logout(){await s.auth.signOut();r.push('/login')}
async function syncPriceGuide(){
  if(!confirm('Sync the Product Catalog with the Google Price Guide?'))return;

  const {data:{session}}=await s.auth.getSession();

  if(!session?.access_token){
    alert('Your login session has expired. Please log in again.');
    return;
  }

  try{
    const response=await fetch('/api/sync-price-guide',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${session.access_token}`
      }
    });

    const result=await response.json();

    if(!response.ok){
      alert(result.error||result.details||'Price Guide sync failed.');
      return;
    }

    await load();

alert(
  `Price Guide sync complete!\n\n`+
  `Added: ${result.added}\n`+
  `Updated: ${result.updated}\n`+
  `Skipped: ${result.skipped}`+
  (result.skipped_details?.length
    ? `\n\nSkipped Details:\n${result.skipped_details.join('\n')}`
    : '')+
  (result.errors?.length
    ? `\n\nErrors:\n${result.errors.join('\n')}`
    : '')
)
  }catch(error){
    console.error(error);
    alert('Price Guide sync failed. Please try again.');
  }
}
async function createCustomer(fd:FormData){await s.from('customers').insert({name:fd.get('name'),company:fd.get('company')||null,email:fd.get('email')||null,phone:fd.get('phone')||null});setModal('');load()}
  async function updateCustomer(fd:FormData){
  const id=String(fd.get('id'));
  const {error}=await s.from('customers').update({
    name:fd.get('name'),
    company:fd.get('company')||null,
    email:fd.get('email')||null,
    phone:fd.get('phone')||null,
    billing_address:fd.get('billing_address')||null,
    shipping_address:fd.get('shipping_address')||null,
    notes:fd.get('notes')||null
  }).eq('id',id);

  if(error){
    alert(error.message);
    return;
  }

 setModal('');
setEditingCustomer(null);
await load();
}
async function createEmployee(fd:FormData){
  const {error}=await s
    .from('employees')
    .insert({
      name:String(fd.get('name')||'').trim(),
      job_title:String(fd.get('job_title')||'').trim()||null,
      email:String(fd.get('email')||'').trim()||null,
      phone:String(fd.get('phone')||'').trim()||null,
      role:String(fd.get('role')||'Employee'),
      erp_access:false,
      active:true,
      notes:String(fd.get('notes')||'').trim()||null
    });

  if(error){
    alert(error.message);
    return;
  }

  setModal('');
  await load();
}
async function inviteEmployee(employee:Employee){
  if(!employee.email){
    alert('This employee needs an email address first.');
    return;
  }

  if(!employee.active){
    alert('Inactive employees cannot manage ERP login access.');
    return;
  }

  const {data:{session}}=await s.auth.getSession();

  if(!session){
    alert('Your login session has expired. Please log in again.');
    return;
  }

// Existing account = generate secure password reset link
if(employee.user_id && employee.invite_status === 'active'){
  const response=await fetch('/api/reset-employee-password',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${session.access_token}`
    },
    body:JSON.stringify({
      employeeId:employee.id
    })
  });

  const result=await response.json();

  if(!response.ok){
    alert(result.error||'Unable to create password reset.');
    return;
  }

alert(
  result.message ||
  `Password reset email sent to ${employee.email}.`
);

return;
}

  // No account yet = send first ERP invitation
  const response=await fetch('/api/invite-employee',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${session.access_token}`
    },
    body:JSON.stringify({
      employeeId:employee.id
    })
  });

  const result=await response.json();

  if(!response.ok){
    alert(result.error||'Unable to invite employee.');
    return;
  }

  alert(result.message||'Employee invitation sent.');
  await load();
}
                                                          async function updateEmployee(fd:FormData){
  if(!editingEmployee)return;

  if(editingEmployee.user_id){
    const {data:{user}}=await s.auth.getUser();

    if(user?.id===editingEmployee.user_id){
      const newRole=String(fd.get('role')||'Employee');
      const newAccess=fd.get('erp_access')==='true';
      const newActive=fd.get('active')==='true';

      if(newRole!=='Admin'||!newAccess||!newActive){
        alert('You cannot remove Admin access, turn off ERP access, or mark your own account inactive.');
        return;
      }
    }
  }
    
  const {error}=await s
    .from('employees')
    .update({
      name:String(fd.get('name')||'').trim(),
      job_title:String(fd.get('job_title')||'').trim()||null,
      email:String(fd.get('email')||'').trim()||null,
      phone:String(fd.get('phone')||'').trim()||null,
role:String(fd.get('role')||'Employee'),
erp_access:fd.get('erp_access')==='true',
active:fd.get('active')==='true',
notes:String(fd.get('notes')||'').trim()||null,
      updated_at:new Date().toISOString()
    })
    .eq('id',editingEmployee.id);

  if(error){
    alert(error.message);
    return;
  }

  setEditingEmployee(null);
  setModal('');
  await load();
}                                                       
async function createQuotationCustomer(fd:FormData){
  if(quickCustomerSaving)return;
  const name=String(fd.get('name')||'').trim();
  if(!name){alert('Customer name is required.');return;}
  setQuickCustomerSaving(true);
  try{
    const {data,error}=await s.from('customers').insert({
      name,
      company:String(fd.get('company')||'').trim()||null,
      email:String(fd.get('email')||'').trim()||null,
      phone:String(fd.get('phone')||'').trim()||null,
      billing_address:String(fd.get('billing_address')||'').trim()||null,
      shipping_address:String(fd.get('shipping_address')||'').trim()||null,
      notes:String(fd.get('notes')||'').trim()||null
    }).select('*').single();
    if(error||!data){alert(`Customer not saved: ${error?.message||'Unknown error'}`);return;}
    const newCustomer=data as Customer;
    setCustomers(prev=>[...prev.filter(c=>c.id!==newCustomer.id),newCustomer].sort((a,b)=>a.name.localeCompare(b.name)));
    setQuotationCustomerName(newCustomer.name);
    setQuotationCustomerId(newCustomer.id);
    setQuickCustomerOpen(false);
  }finally{
    setQuickCustomerSaving(false);
  }
}
async function createOrder(fd:FormData){
  const customer=String(fd.get('customer_id')||'');
  if(!customer){alert('Please select a customer before creating the quotation.');return;}
  const tax=Number(fd.get('tax_rate')||0);
  const reference=String(fd.get('reference_number')||'').trim();
  const orderDate=String(fd.get('order_date')||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)||Number.isNaN(Date.parse(orderDate+'T12:00:00'))){
    alert('Please enter a valid order date.');
    return;
  }
  const {data,error}=await s.from('orders').insert({
    customer_id:customer,
    reference_number:reference||null,
    tax_rate:tax,
    order_date:orderDate,
    status:'Draft',
    payment_status:'Not Invoiced'
  }).select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)').single();
  if(error){alert(`Order not saved: ${error.message}`);return;}
  setModal('');
  await load();
  if(data){setSelected(data as Order);setTab('Order');}
}
async function addProduct(pid:string){if(!selected)return;let p=products.find(x=>x.id===pid);if(!p)return;await s.from('order_items').insert({order_id:selected.id,product_id:p.id,item_type:'Product',description:p.name,sku:p.sku,vendor:p.vendor,qty:1,sell_price:p.sell_price,cost:p.cost,purchasing_status:'Need to Order'});await refreshOrder()}
async function addOther(fd:FormData){if(!selected)return;let type=String(fd.get('item_type')),sell=Number(fd.get('sell_price')||0);if(type==='Discount'&&sell>0)sell=-sell;await s.from('order_items').insert({order_id:selected.id,item_type:type,description:fd.get('description'),qty:Number(fd.get('qty')||1),sell_price:sell,cost:fd.get('cost')?Number(fd.get('cost')):null,purchasing_status:'N/A'});setModal('');refreshOrder()}
async function refreshOrder(){if(!selected)return;let {data}=await s.from('orders').select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)').eq('id',selected.id).single();if(data)setSelected(data as any);load()}
async function dup(i:Item){let {id,...copy}=i as any;copy.tracking=null;copy.vendor_order_number=null;copy.eta_date=null;copy.purchasing_notes=null;if(copy.item_type==='Product')copy.purchasing_status='Need to Order';await s.from('order_items').insert(copy);refreshOrder()}
async function del(i:Item){if(!confirm(`Remove ${i.description}?`))return;await s.from('order_items').delete().eq('id',i.id);refreshOrder()}
async function updateItem(i:Item,k:string,v:any){
  beginAutoSave();
  try{
    const {error}=await s.from('order_items').update({[k]:v}).eq('id',i.id);
    finishAutoSave(error);
    if(error){console.error('Item autosave failed:',error);return;}
    await refreshOrder();
  }catch(error){finishAutoSave({message:'Network error'});console.error('Item autosave failed:',error);}
}
async function updateOrderDetails(
  reference:string,
  shippingAddress:string,
  taxRate:number,
  shippingAmount:number,
  taxExempt:boolean,
  orderDate:string
):Promise<boolean>{
  if(!selected)return false;
  const validDate=/^\d{4}-\d{2}-\d{2}$/.test(orderDate) &&
    !Number.isNaN(Date.parse(orderDate+'T12:00:00'));
  if(!validDate){alert('Please enter a valid order date.');return false;}
  if(!Number.isFinite(taxRate)||taxRate<0||!Number.isFinite(shippingAmount)||shippingAmount<0){
    alert('Tax rate and shipping amount must be valid, nonnegative numbers.');
    return false;
  }
  const {error}=await s.from('orders').update({
    reference_number:reference.trim()||null,
    shipping_address:shippingAddress.trim()||null,
    tax_rate:taxRate,
    shipping_amount:shippingAmount,
    tax_exempt:taxExempt,
    order_date:orderDate
  }).eq('id',selected.id);
  if(error){
    console.error('Order details update error:',error);
    alert(`Could not save order details: ${error.message}`);
    return false;
  }
  await refreshOrder();
  return true;
}
async function updateOrderStatus(status:string){
  if(!selected || status===selected.status)return;
  if(status==='Draft'){
    const [poCheck,buildCheck,paymentCheck]=await Promise.all([
      s.from('purchase_orders').select('id',{count:'exact',head:true}).eq('order_id',selected.id),
      s.from('builds').select('id',{count:'exact',head:true}).eq('order_id',selected.id),
      s.from('payments').select('id',{count:'exact',head:true}).eq('order_id',selected.id)
    ]);
    const checkError=poCheck.error||buildCheck.error||paymentCheck.error;
    if(checkError){alert(`Unable to verify order commitments: ${checkError.message}`);return;}
    if((poCheck.count||0)+(buildCheck.count||0)+(paymentCheck.count||0)>0){
      alert('This order has payments, purchase orders, or builds. Resolve these commitments before returning it to Draft.');return;
    }
    if(!confirm('Move this Sales Order back to Quotations as a Draft?'))return;
  }
  const {error}=await s.from('orders').update({status}).eq('id',selected.id);
  if(error){alert(`Could not change status: ${error.message}`);return;}
  await refreshOrder();
  setTab(status==='Draft'?'Quotations':'Orders');
  setSelected(null);
  setOrderPage(1);
}
async function addOrderNote(note:string){if(!selected||!note.trim())return;const {data:{user}}=await s.auth.getUser();await s.from('order_notes').insert({order_id:selected.id,note:note.trim(),created_by:user?.id||null});await refreshOrder()}
async function createPurchaseOrder(order:Order,items:Item[]){if(order.status==='Draft'){alert('Convert this quotation to a Sales Order before creating a Purchase Order.');return;}if(!order.reference_number){alert('Add a Reference # to this Sales Order before creating a PO.');return}if(!items.length)return;const vendors=[...new Set(items.map(i=>i.vendor||'').filter(Boolean))];if(vendors.length!==1){alert('A PO can only contain items from one vendor.');return}const vendor=vendors[0];let {data:po,error}=await s.from('purchase_orders').insert({po_number:order.reference_number,order_id:order.id,vendor,status:'Ordered'}).select('*').single();if(error||!po){alert(error?.message||'Could not create PO.');return}const snapshots=items.map((i,idx)=>({purchase_order_id:po.id,order_item_id:i.id,description:i.description,sku:i.sku,qty:i.qty,unit_cost:i.cost,sort_order:idx}));let {error:itemError}=await s.from('purchase_order_items').insert(snapshots);if(itemError){await s.from('purchase_orders').delete().eq('id',po.id);alert(itemError.message);return}await s.from('order_items').update({purchasing_status:'Ordered'}).in('id',items.map(i=>i.id));await load();let {data:full}=await s.from('purchase_orders').select('*,purchase_order_items(*),orders(*,customers(*))').eq('id',po.id).single();if(full){setSelectedPO(full as any);setSelected(null);setTab('Purchase Order')}}
async function openInvoice(){if(!selected)return;if(selected.payment_status==='Not Invoiced'){await s.from('orders').update({payment_status:'Invoiced'}).eq('id',selected.id);await refreshOrder()}setTab('Invoice')}
async function addPayment(fd:FormData){
  if(!selected || paymentSubmissionInProgress.current)return;
  const orderId=selected.id;
  const amount=Number(fd.get('amount'));
  const paidAt=String(fd.get('paid_at')||'');
  if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.000001){alert('Enter a valid payment amount in dollars and cents.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)||Number.isNaN(Date.parse(paidAt+'T12:00:00'))){alert('Please enter a valid payment date.');return;}
  paymentSubmissionInProgress.current=true;
  try{
    const {data:current,error:readError}=await s.from('orders')
      .select('*,order_items(*),payments(*),payment_adjustments(*)').eq('id',orderId).single();
    if(readError||!current){alert(`Unable to verify balance: ${readError?.message||'Order not found'}`);return;}
    const subtotal=(current.order_items||[]).reduce((sum:number,item:any)=>sum+Number(item.qty)*Number(item.sell_price),0);
    const tax=current.tax_exempt?0:subtotal*Number(current.tax_rate||0)/100;
    const totalCents=Math.round((subtotal+tax+Number(current.shipping_amount||0))*100);
    const paidCents=(current.payments||[]).reduce((sum:number,p:any)=>sum+Math.round(Number(p.amount)*100),0)
      -(current.payment_adjustments||[]).reduce((sum:number,x:any)=>sum+Math.round(Number(x.amount)*100),0);
    const remainingCents=Math.max(0,totalCents-paidCents);
    const amountCents=Math.round(amount*100);
    if(remainingCents===0){alert('This invoice is already paid in full. No additional payment was recorded.');return;}
    if(amountCents>remainingCents){alert(`Payment exceeds the outstanding balance of $${(remainingCents/100).toFixed(2)}. No payment was recorded.`);return;}
    const {error:paymentError}=await s.from('payments').insert({
      order_id:orderId,amount:amountCents/100,paid_at:paidAt,
      payment_method:fd.get('payment_method')||null,
      reference:fd.get('reference')||null,notes:fd.get('notes')||null
    });
    if(paymentError){alert(`Payment not saved: ${paymentError.message}`);return;}
    const {data:updated,error:updateReadError}=await s.from('orders')
      .select('*,order_items(*),payments(*),payment_adjustments(*)').eq('id',orderId).single();
    if(updateReadError||!updated){alert('Payment saved, but the payment status could not be refreshed. Please reload the invoice.');return;}
    const updatedSubtotal=(updated.order_items||[]).reduce((sum:number,item:any)=>sum+Number(item.qty)*Number(item.sell_price),0);
    const updatedTotal=Math.round((updatedSubtotal+(updated.tax_exempt?0:updatedSubtotal*Number(updated.tax_rate||0)/100)+Number(updated.shipping_amount||0))*100);
    const updatedPaid=(updated.payments||[]).reduce((sum:number,p:any)=>sum+Math.round(Number(p.amount)*100),0)
      -(updated.payment_adjustments||[]).reduce((sum:number,x:any)=>sum+Math.round(Number(x.amount)*100),0);
    const status=updatedPaid>=updatedTotal?'Paid':updatedPaid>0?'Partially Paid':'Invoiced';
    const {error:statusError}=await s.from('orders').update({payment_status:status}).eq('id',orderId);
    if(statusError)alert(`Payment recorded, but payment status could not be updated: ${statusError.message}`);
    setModal('');await refreshOrder();setTab('Invoice');
  }finally{paymentSubmissionInProgress.current=false;}
}
 async function recordAdjustment(fd:FormData){
   if(!selected||!adjustmentPayment||adjustmentSubmissionInProgress.current)return;
   const orderId=selected.id;
   const paymentId=adjustmentPayment.id;
   const kind=String(fd.get('adjustment_type'));
   const amount=kind==='Void'?Number(adjustmentPayment.amount):Number(fd.get('amount'));
   const reason=String(fd.get('reason')||'').trim();
   const squareReference=String(fd.get('square_reference')||'').trim();
   if(!['Refund','Void'].includes(kind)||!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.000001||!reason){
     alert('Enter a valid adjustment amount in dollars and cents and a reason.');
     return;
   }
   if(!confirm(`Record ${kind.toLowerCase()} of $${amount.toFixed(2)}? This only updates the ERP, not Square.`))return;
   adjustmentSubmissionInProgress.current=true;
   try{
     const {error}=await s.rpc('record_payment_adjustment',{
       p_payment_id:paymentId,
       p_adjustment_type:kind,
       p_amount:Math.round(amount*100)/100,
       p_reason:reason,
       p_square_reference:squareReference||null
     });
     if(error){alert(`Adjustment not saved: ${error.message}`);return;}

     // The adjustment has been recorded. Recalculate the invoice's status from fresh data.
     const {data:updated,error:readError}=await s.from('orders')
       .select('*,order_items(*),payments(*),payment_adjustments(*)')
       .eq('id',orderId).single();
     if(readError||!updated){
       alert('Adjustment recorded, but the payment status could not be refreshed. Please reload the invoice.');
     }else{
       const subtotal=(updated.order_items||[]).reduce((sum:number,item:any)=>sum+Number(item.qty)*Number(item.sell_price),0);
       const totalCents=Math.round((subtotal+(updated.tax_exempt?0:subtotal*Number(updated.tax_rate||0)/100)+Number(updated.shipping_amount||0))*100);
       const paidCents=(updated.payments||[]).reduce((sum:number,p:any)=>sum+Math.round(Number(p.amount)*100),0)
         -(updated.payment_adjustments||[]).reduce((sum:number,x:any)=>sum+Math.round(Number(x.amount)*100),0);
       const status=paidCents>=totalCents?'Paid':paidCents>0?'Partially Paid':'Invoiced';
       const {error:statusError}=await s.from('orders').update({payment_status:status}).eq('id',orderId);
       if(statusError)alert(`Adjustment recorded, but payment status could not be updated: ${statusError.message}`);
     }
     setModal('');
     setAdjustmentPayment(null);
     await refreshOrder();
   }catch(error){
     console.error('Payment adjustment error:',error);
     alert('Could not confirm the adjustment result. Refresh the invoice before attempting again to avoid a duplicate.');
   }finally{
     adjustmentSubmissionInProgress.current=false;
   }
 }
async function createBuild(order:any){
  const existing=builds.filter(b=>b.order_id===order.id);
  const buildIndex=existing.length+1;

  const buildNumber=`${order.order_number}-B${buildIndex}`;

  const {data,error}=await s
    .from('builds')
    .insert({
      order_id:order.id,
      build_number:buildNumber,
      name:`Simulator ${buildIndex}`,
      status:'Not Started'
    })
    .select()
    .single();

  if(error){
    alert(error.message);
    return;
  }

  setBuilds(prev=>[data as Build,...prev]);

  alert(`Build ${buildNumber} created.`);
}

async function updateBuild(id:string,patch:Partial<Build>){
  beginAutoSave();
  let result;
  try{result=await s
    .from('builds')
    .update({
      ...patch,
      updated_at:new Date().toISOString()
    })
    .eq('id',id)
    .select()
    .single();
  }catch(error){finishAutoSave({message:'Network error'});console.error('Build autosave failed:',error);return;}
  const {data,error}=result;
  finishAutoSave(error);
  if(error){console.error('Build autosave failed:',error);return;}

  const updated=data as Build;

  setBuilds(prev=>prev.map(b=>b.id===id?updated:b));

  if(selectedBuild?.id===id){
    setSelectedBuild(updated);
  }
}
async function setBuildCancellation(build:Build,cancel:boolean){
  if(me?.role!=='Admin')return;
  beginAutoSave();
  let result;
  try{
    result=await s.from('builds').update({canceled_at:cancel?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',build.id).select().single();
  }catch(error){finishAutoSave({message:'Network error'});alert('Unable to update build.');return;}
  finishAutoSave(result.error);
  if(result.error){alert(`Unable to ${cancel?'cancel':'restore'} build: ${result.error.message}`);return;}
  const updated=result.data as Build;
  setBuilds(prev=>prev.map(b=>b.id===updated.id?updated:b));
  setSelectedBuild(prev=>prev?.id===updated.id?updated:prev);
  setShowCancelBuildConfirm(false);
}
async function assignBuildItem(buildId:string,orderItemId:string,qty:number){
  // Find the original Sales Order item so we know how many were ordered
  const orderItem = orders
    .flatMap(o => o.order_items || [])
    .find((i:any) => i.id === orderItemId);

  if(!orderItem){
    alert('Could not find the Sales Order item.');
    return;
  }

  const orderedQty = Number(orderItem.qty);

  // Count how many of this item are already assigned to OTHER builds
  const assignedToOtherBuilds = buildItems
    .filter(
      bi =>
        bi.order_item_id === orderItemId &&
        bi.build_id !== buildId
    )
    .reduce((total, bi) => total + Number(bi.qty), 0);

  const availableQty = orderedQty - assignedToOtherBuilds;

  // Prevent assigning more than the Sales Order contains
  if(qty > availableQty){
    alert(
      `Only ${availableQty} remaining ${
        availableQty === 1 ? 'is' : 'are'
      } available to assign.`
    );
    return;
  }

  const existing = buildItems.find(
    bi => bi.build_id === buildId && bi.order_item_id === orderItemId
  );

  if(existing){
    beginAutoSave();
  const {data,error} = await s
      .from('build_items')
      .update({
        qty,
        updated_at:new Date().toISOString()
      })
      .eq('id',existing.id)
      .select()
      .single();

    finishAutoSave(error);
    if(error){console.error('Build item autosave failed:',error);return;}

    setBuildItems(prev =>
      prev.map(bi => bi.id === existing.id ? data as BuildItem : bi)
    );

    return;
  }

  beginAutoSave();
  const {data,error} = await s
    .from('build_items')
    .insert({
      build_id:buildId,
      order_item_id:orderItemId,
      qty
    })
    .select()
    .single();

  finishAutoSave(error);
  if(error){console.error('Build item autosave failed:',error);return;}

  setBuildItems(prev => [...prev,data as BuildItem]);
}
async function removeBuildItem(buildId:string,orderItemId:string){
  const existing=buildItems.find(
    bi=>bi.build_id===buildId&&bi.order_item_id===orderItemId
  );

  if(!existing)return;

  beginAutoSave();
  const {error}=await s
    .from('build_items')
    .delete()
    .eq('id',existing.id);

  finishAutoSave(error);
  if(error){console.error('Build item autosave failed:',error);return;}

  setBuildItems(prev=>prev.filter(bi=>bi.id!==existing.id));
}
let filteredCustomers=customers.filter(c=>[c.name,c.company,c.email,c.phone].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
const modules =
  me?.role === 'Admin'
    ? ['Sales', 'Purchases', 'Builds', 'Inventory', 'Accounting', 'Employees']
    : me?.role === 'Technician'
      ? ['Builds']
      : ['Sales', 'Purchases', 'Builds', 'Inventory'];

const moduleNavItems:Record<string,string[]> = {
  Sales: [
    'Dashboard',
    'Customers',
    'Quotations',
    'Orders',
    'Products'
  ],
  Purchases: [
    'Purchasing',
    'Purchase Orders',
    'Products'
  ],
  Builds: [
    'Builds'
  ],
  Inventory: [
    'Inventory Forecast',
    'Product Analytics',
    'Vendor Analytics',
    'Products'
  ],
  Accounting: [
    'Sales Accounting Overview',
    'Payments',
    'Outstanding Balances',
    'Expenses',
    'Vendor Bills',
    'Financial Reports'
  ],
  Employees: [
    'Employees'
  ]
};

// Technician scope and canceled-build visibility are enforced in this workspace.
const canViewCanceledBuilds=me?.role==='Admin'||me?.role==='Manager';
const technicianOnly=me?.role==='Technician';
const visibleBuilds=builds.filter(b=>{
  if(technicianOnly)return !b.canceled_at && !!me?.id && b.assigned_technician_id===me.id;
  if(!canViewCanceledBuilds&&b.canceled_at)return false;
  if(buildScope==='Mine'&&b.assigned_technician_id!==me?.id)return false;
  return buildFilter==='All'||(buildFilter==='Canceled'?!!b.canceled_at:!b.canceled_at);
}).sort((a,b)=>{
  const aDate=buildDateValue(a.installation_date),bDate=buildDateValue(b.installation_date);
  if(aDate&&bDate)return aDate.localeCompare(bDate);
  if(aDate)return -1;if(bDate)return 1;
  return a.build_number.localeCompare(b.build_number);
});
const safeBuildPage=Math.min(buildListPage,Math.max(1,Math.ceil(visibleBuilds.length/LIST_PAGE_SIZE)));
const pagedBuilds=visibleBuilds.slice((safeBuildPage-1)*LIST_PAGE_SIZE,safeBuildPage*LIST_PAGE_SIZE);
const buildChecklistCounts=(b:Build)=>{
  const partKeys=buildItems.filter(x=>x.build_id===b.id&&Number(x.qty)>0).map(x=>`part:${x.id}`);
  const keys=[...partKeys,...assemblyTasks.map(([key])=>key)];
  const completed=keys.filter(key=>buildSummary.some(p=>p.build_id===b.id&&p.task_key===key&&p.completed)).length;
  return {completed,total:keys.length,parts:partKeys.length,verified:partKeys.filter(key=>buildSummary.some(p=>p.build_id===b.id&&p.task_key===key&&p.completed)).length};
};
// Read-only analytics are calculated from order-line snapshots, never current catalog prices.
// Exclude drafts/cancellations; refunds are not item-attributed in the existing schema.
const analyticsLines=useMemo(()=>{
  const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const lines:{id:string,orderId:string,orderNumber:string,date:string,productKey:string,product:string,sku:string,vendor:string,qty:number,revenue:number,cost:number|null}[]=[];
  for(const order of forecastOrders){
    if(order.status==='Draft'||/cancelled|canceled/i.test(order.status))continue;
    const date=(order.order_date||order.created_at||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const age=Math.floor((today.getTime()-new Date(date+'T12:00:00').getTime())/86400000);
    if(age<0||!Number.isFinite(age)||(analyticsPeriod!=='all'&&age>=Number(analyticsPeriod)))continue;
    for(const item of order.order_items||[]){
      if(item.item_type!=='Product')continue;
      const qty=Number(item.qty),sell=Number(item.sell_price);
      if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(sell))continue;
      const rawCost=item.cost===null||item.cost===undefined?null:Number(item.cost);
      const cost=rawCost!==null&&Number.isFinite(rawCost)?qty*rawCost:null;
      const productKey=item.product_id?`id:${item.product_id}`:item.sku?.trim()?`sku:${item.sku.trim().toLowerCase()}`:`name:${item.description.trim().toLowerCase()}`;
      lines.push({id:item.id,orderId:order.id,orderNumber:order.order_number,date,productKey,product:item.description,sku:item.sku||'—',vendor:item.vendor?.trim()||'Unassigned',qty,revenue:qty*sell,cost});
    }
  }
  return lines;
},[forecastOrders,analyticsPeriod]);
type AnalyticsRow={key:string,name:string,units:number,revenue:number,cost:number,knownRevenue:number,missingCosts:number,orders:Set<string>,months:Record<string,{revenue:number,units:number}>,lastSale:string};
const buildAnalyticsRows=(kind:'product'|'vendor')=>{
  const map=new Map<string,AnalyticsRow>();
  for(const line of analyticsLines){
    const key=kind==='vendor'?line.vendor.toLowerCase():line.productKey;
    let row=map.get(key);
    if(!row){row={key,name:kind==='vendor'?line.vendor:line.product,units:0,revenue:0,cost:0,knownRevenue:0,missingCosts:0,orders:new Set(),months:{},lastSale:''};map.set(key,row);}
    row.units+=line.qty;row.revenue+=line.revenue;
    if(line.cost===null)row.missingCosts++;else{row.cost+=line.cost;row.knownRevenue+=line.revenue;}
    row.orders.add(line.orderId);
    const month=line.date.slice(0,7);
    if(!row.months[month])row.months[month]={revenue:0,units:0};
    row.months[month].revenue+=line.revenue;row.months[month].units+=line.qty;
    if(line.date>row.lastSale)row.lastSale=line.date;
  }
  return [...map.values()].sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name));
};
const productAnalyticsRows=buildAnalyticsRows('product');
const vendorAnalyticsRows=buildAnalyticsRows('vendor');
const analyticsIsVendor=tab==='Vendor Analytics';
const analyticsRows=(analyticsIsVendor?vendorAnalyticsRows:productAnalyticsRows).filter(row=>{
  if(!analyticsSearch.trim())return true;
  const term=analyticsSearch.toLowerCase();
  return row.name.toLowerCase().includes(term)||analyticsLines.some(l=>(analyticsIsVendor?l.vendor.toLowerCase()===row.key:l.productKey===row.key)&&`${l.sku} ${l.product} ${l.vendor}`.toLowerCase().includes(term));
});
const analyticsSafePage=Math.min(analyticsPage,Math.max(1,Math.ceil(analyticsRows.length/LIST_PAGE_SIZE)));
const analyticsDetail=(analyticsIsVendor?vendorAnalyticsRows:productAnalyticsRows).find(row=>row.key===analyticsSelected);
const analyticsDetailLines=analyticsDetail?analyticsLines.filter(l=>analyticsIsVendor?l.vendor.toLowerCase()===analyticsDetail.key:l.productKey===analyticsDetail.key).sort((a,b)=>b.date.localeCompare(a.date)):[];
const analyticsSafeDetailPage=Math.min(analyticsDetailPage,Math.max(1,Math.ceil(analyticsDetailLines.length/LIST_PAGE_SIZE)));
const analyticsMoney=(amount:number)=>amount.toLocaleString('en-US',{style:'currency',currency:'USD'});
const filteredForecastRows=forecastRows.filter(r=>(forecastVendor==='All'||r.vendor===forecastVendor)&&`${r.sku} ${r.name} ${r.vendor}`.toLowerCase().includes(forecastSearch.toLowerCase()));
const safeForecastPage=Math.min(forecastPage,Math.max(1,Math.ceil(filteredForecastRows.length/LIST_PAGE_SIZE)));
const navItems = moduleNavItems[module] || ['Dashboard'];
return <div className="shell">
<style>{FX_CSS}</style>
  <aside className={`side ${mobileMenuOpen?"mobile-open":""}`}>
    <img
      className="logo"
      src="/flatout-logo.svg"
      onClick={()=>{setMobileMenuOpen(false);setTab(({Sales:'Dashboard',Purchases:'Purchasing',Builds:'Builds',Inventory:'Inventory Forecast',Accounting:'Sales Accounting Overview',Employees:'Employees'} as Record<string,string>)[module]||'Dashboard');}}
      style={{cursor:'pointer'}}
    />

    <div className="nav">
      {navItems.map(x=>
        <button
          key={x}
          className={tab===x?'active':''}
          onClick={()=>{
            setTab(x);
            setMobileMenuOpen(false);
            setSelected(null);
            setSelectedPO(null);
          }}
        >
          {x}
        </button>
      )}
    </div>
  </aside>

  <main className="main">
    <div className="mobileHeader"><button type="button" className="btn secondary mobileMenuToggle" aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(v=>!v)}>{mobileMenuOpen?"✕ Close":"☰ Menu"}</button><strong>FLATOUT ERP</strong><span>{module}</span></div>
    <div
      className="moduleNav"
      style={{
        display:'flex',
        gap:8,
        padding:'10px 16px',
        background:'#111',
        borderBottom:'1px solid #333'
      }}
    >
      {modules.map(m=>
        <button
          key={m}
          className={module===m?'btn':'btn secondary'}
          onClick={()=>{
            setModule(m);
            setMobileMenuOpen(false);
            setTab(({Sales:'Dashboard',Purchases:'Purchasing',Builds:'Builds',Inventory:'Inventory Forecast',Accounting:'Sales Accounting Overview',Employees:'Employees'} as Record<string,string>)[m]||'Dashboard');
            setSelected(null);

        
            setSelectedPO(null);
            setSelectedBuild(null);
          }}
        >
          {m}
        </button>
      )}
    </div>

    <div className="top"><div><b>{selected?(tab==='Invoice'?`${selected.order_number} — Invoice`:selected.order_number):selectedPO&&tab==='Purchase Order'?`${selectedPO.po_number} — Purchase Order`:tab}</b><div className="muted">Flatout Sim Racing ERP</div></div><div className="row">{autoSaveStatus!=='idle'&&<span role="status" aria-live="polite" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:autoSaveStatus==='error'?'#dc2626':autoSaveStatus==='saved'?'#15803d':'#64748b'}}>
      {autoSaveStatus==='saving'?'◌ Saving...':autoSaveStatus==='saved'?'✓ Saved':'⚠ Not saved'}
      {autoSaveStatus==='error'&&<button type="button" onClick={retryAutoSaveStatus} title="Dismiss warning (does not retry saving)" style={{background:'none',border:0,cursor:'pointer',color:'inherit',fontSize:12}}>Dismiss</button>}
    </span>}<span className="muted">{email}</span><button className="btn secondary" onClick={logout}>Log out</button></div></div><div className="content">
{tab==='Dashboard'&&<><div className="cards"><div className="card"><div className="muted">Customers</div><div className="value">{customers.length}</div></div><div className="card"><div className="muted">Open Orders</div><div className="value">{confirmedOrders.filter(o=>o.status!=='Completed').length}</div></div><div className="card"><div className="muted">Parts Awaiting</div><div className="value">{need.length}</div></div><div className="card"><div className="muted">Products</div><div className="value">{products.length}</div></div></div><div className="panel"><h2>Recent Orders</h2><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="fx-num">Sell</th><th className="fx-num">Margin</th></tr></thead><tbody>{confirmedOrders.slice(0,10).map(o=>{let t=totals(o);return <tr key={o.id} className="fx-row" onClick={()=>{setSelected(o);setTab('Order')}} style={{cursor:'pointer'}}><td><span className="fx-link">{o.order_number}</span></td><td>{(o.customers as any)?.name}</td><td><StatusBadge status={o.status}/></td><td className="fx-num">{fmtMoney(t.sell)}</td><td className="fx-num">{t.gm.toFixed(1)}%</td></tr>})}</tbody></table></div></>}
{module==='Accounting'&&(['Sales Accounting Overview','Payments','Outstanding Balances','Expenses','Vendor Bills','Financial Reports'].includes(tab))&&<AccountingWorkspace tab={tab as any} openOrder={async(id)=>{const {data,error}=await s.from('orders').select('*,customers(*),order_items(*),payments(*),payment_adjustments(*),order_notes(*)').eq('id',id).single();if(error||!data){alert(error?.message||'Order not found');return;}setSelected(data as Order);setTab('Invoice');}}/>}
{tab==='Employees'&&<section className="card">
  <div className="row" style={{justifyContent:'space-between'}}>
  <h2>Employees</h2>
  <button className="btn" onClick={()=>setModal('employee-new')}>+ New Employee</button>
</div>

  <div className="tableWrap">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Job Title</th>
          <th>Email</th>
          <th>Role</th>
          <th>ERP Access</th>
          <th>Status</th>
<th></th>
        </tr>
      </thead>
      <tbody>
        {employees.slice((employeeListPage-1)*LIST_PAGE_SIZE,employeeListPage*LIST_PAGE_SIZE).map(e=><tr
          key={e.id}
          onClick={()=>{setEditingEmployee(e);setModal('viewEmployee')}}
          onKeyDown={event=>{
            if(event.key==='Enter'||event.key===' '){
              event.preventDefault();
              setEditingEmployee(e);
              setModal('viewEmployee');
            }
          }}
          tabIndex={0}
          aria-label={`View employee ${e.name}`}
          style={{cursor:'pointer'}}
        >
          <td>{e.name}</td>
          <td>{e.job_title||'—'}</td>
          <td>{e.email||'—'}</td>
          <td>{e.role}</td>
          <td>{e.erp_access?'On':'Off'}</td>
          <td>{e.active?'Active':'Inactive'}</td>
<td><span className="muted">View →</span></td>
        </tr>)}
      </tbody>
    </table>
  </div>
  <ListPagination page={employeeListPage} onPageChange={setEmployeeListPage} total={employees.length}/>
</section>}
 {tab==='Builds'&&
  <section className="card">
    <div className="row" style={{justifyContent:'space-between'}}>
      <div>
        <h2>{technicianOnly?'My Builds':'Builds'}</h2>
        <div className="muted">
          {technicianOnly?'Your assigned active builds and installation workflow':'Simulator builds and installation workflow'}
        </div>
      </div>
    </div>

    {!technicianOnly&&<div style={{display:'flex',flexDirection:'column',gap:12,marginTop:14,marginBottom:14}}>
      <div>
        <div className="muted" style={{fontSize:12,fontWeight:700,marginBottom:6}}>BUILD VIEW</div>
        <div className="row" style={{gap:8,flexWrap:'wrap'}}>
          <button type="button" className={buildScope==='Mine'?'btn secondary fx-selected':'btn secondary'} onClick={()=>setBuildScope('Mine')}>My Builds</button>
          <button type="button" className={buildScope==='All'?'btn secondary fx-selected':'btn secondary'} onClick={()=>setBuildScope('All')}>All Builds</button>
        </div>
      </div>
      <div>
        <div className="muted" style={{fontSize:12,fontWeight:700,marginBottom:6}}>BUILD STATUS</div>
        <div className="row" style={{gap:8,flexWrap:'wrap'}}>
          {(['Active',...(canViewCanceledBuilds?['Canceled','All']:[])] as ('Active'|'Canceled'|'All')[]).map(f=><button key={f} type="button" className={buildFilter===f?'btn secondary fx-selected':'btn secondary'} onClick={()=>setBuildFilter(f)}>{f==='All'?'All Statuses':f}</button>)}
        </div>
      </div>
    </div>}
    <div className="mobileCards">
      {visibleBuilds.length===0&&<div className="muted">No builds have been created yet.</div>}
      {pagedBuilds.map(b=>{
        const order=orders.find(o=>o.id===b.order_id);
        const tech=employees.find(e=>e.id===b.assigned_technician_id);
        return <div className="mobileWorkCard" key={b.id}>
          <div className="mobileCardHeading"><div><b>{b.build_number}</b><div className="muted">{b.name||'Simulator Build'}</div></div><span className="mobileStatus">{b.canceled_at?'Canceled':b.status}</span></div>
          <div className="mobileFacts"><div><small>Sales Order</small><strong>{order?.order_number||'—'}</strong></div><div><small>Customer</small><strong>{order?.customers?.name||'—'}</strong></div><div><small>Technician</small><strong>{tech?.name||'Unassigned'}</strong></div><div><small>Installation</small><strong>{b.installation_date?displayBuildDate(b.installation_date):'—'}</strong></div></div>
          {(()=>{const p=buildChecklistCounts(b);return <div style={{margin:'12px 0',fontSize:12}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span>Checklist progress</span><b>{p.completed}/{p.total} ({Math.round(100*p.completed/Math.max(1,p.total))}%)</b></div><div style={{height:7,borderRadius:6,background:'#ddd',overflow:'hidden'}}><div style={{height:'100%',width:`${100*p.completed/Math.max(1,p.total)}%`,background:'#e71d36'}}/></div><div className="muted" style={{marginTop:4}}>Parts verified: {p.verified}/{p.parts}</div></div>})()}
          <button type="button" className="btn mobileFullButton" onClick={()=>{setShowCancelBuildConfirm(false);setSelectedBuild(b);setTab('Build')}}>Open Build</button>
        </div>;
      })}
    </div>
    <div className="tableWrap desktopWorkTable">
      <table>
        <thead>
          <tr>
            <th>Build</th>
            <th>Name</th>
            <th>Sales Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Technician</th>
            <th>Installation</th>
            <th>Checklist</th>
          </tr>
        </thead>

        <tbody>
          {visibleBuilds.length===0 ? (
            <tr>
              <td colSpan={8}>
                <div className="muted" style={{padding:20}}>
                  No builds have been created yet.
                </div>
              </td>
            </tr>
          ) : (
            pagedBuilds.map(b=>{
              const order=orders.find(o=>o.id===b.order_id)
              const technician=employees.find(
                e=>e.id===b.assigned_technician_id
              )

              return (
               <tr
  key={b.id}
  className="fx-row"
  onClick={()=>{
    setShowCancelBuildConfirm(false);setSelectedBuild(b);
    setTab('Build');
  }}
  style={{cursor:'pointer'}}
>
                  <td><b className="fx-link">{b.build_number}</b></td>
                  <td>{b.name||'—'}</td>
                  <td>{order?.order_number||'—'}</td>
                  <td>{(order?.customers as any)?.name||'—'}</td>
                  <td><StatusBadge status={b.canceled_at?'Canceled':b.status}/></td>
                  <td>{technician?.name||'Unassigned'}</td>
                  <td>
                    {b.installation_date
                      ? displayBuildDate(b.installation_date)
                      : '—'}
                  </td>
                  <td>{(()=>{const p=buildChecklistCounts(b);return <span>{p.completed}/{p.total} ({Math.round(100*p.completed/Math.max(1,p.total))}%)</span>})()}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
    <ListPagination page={safeBuildPage} onPageChange={setBuildListPage} total={visibleBuilds.length}/>
  </section>
}
  {tab==='Build'&&selectedBuild&&(!technicianOnly||(!selectedBuild.canceled_at&&selectedBuild.assigned_technician_id===me?.id))&&(canViewCanceledBuilds||!selectedBuild.canceled_at)&&(()=>{
  const order=orders.find(o=>o.id===selectedBuild.order_id)
  const technician=employees.find(e=>e.id===selectedBuild.assigned_technician_id)

  return <section className="card buildDetailScreen">
    <div className="row buildDetailHeader" style={{justifyContent:'space-between',alignItems:'flex-start'}}>
      <div>
        <button
          className="btn secondary"
          onClick={()=>{
            setSelectedBuild(null);
            setTab('Builds');
          }}
        >
          ← Back to Builds
        </button>

        <div className="row" style={{marginTop:10,flexWrap:'wrap'}}>
          <button type="button" className="btn secondary" onClick={()=>printTechnicianBuildSheet(selectedBuild,order,technician?.name||'Unassigned',buildItems)}>▣ Print Build Sheet</button>
          {me?.role==='Admin'&&(selectedBuild.canceled_at
            ? <button type="button" className="btn ghost" onClick={()=>void setBuildCancellation(selectedBuild,false)}>↻ Restore Build</button>
            : <button type="button" className="btn ghost" style={{color:'#b91c1c',border:'1px solid #b91c1c'}} onClick={()=>setShowCancelBuildConfirm(true)}>Cancel Build</button>)}
        </div>
        {showCancelBuildConfirm&&!selectedBuild.canceled_at&&<div className="panel" style={{padding:14,maxWidth:440,border:'1px solid #b91c1c'}}>
          <b>Cancel this build?</b>
          <p className="muted">It will be hidden from Active Builds. Its original status, notes, parts and Sales Order link will be preserved.</p>
          <div className="row" style={{flexWrap:'wrap'}}><button type="button" className="btn" onClick={()=>void setBuildCancellation(selectedBuild,true)}>Yes, Cancel Build</button><button type="button" className="btn secondary" onClick={()=>setShowCancelBuildConfirm(false)}>Keep Build</button></div>
        </div>}
        <h1 style={{marginBottom:4}}>{selectedBuild.build_number}</h1>
        {selectedBuild.canceled_at&&<div style={{fontWeight:800,color:'#b91c1c'}}>Canceled — hidden from Active Builds</div>}

        <div className="muted">
          {order?.customers?.name||'Customer'} • {order?.order_number||'Sales Order'}
        </div>
      </div>

<div className="field buildStatusField" style={{margin:0,minWidth:220}}>
  <label>Build Status</label>
  <select
    value={selectedBuild.status}
    disabled={!!selectedBuild.canceled_at}
    onChange={e=>updateBuild(
      selectedBuild.id,
      {status:e.target.value as Build['status']}
    )}
  >
    {[
      'Not Started',
      'Waiting for Parts',
      'Ready to Build',
      'Building',
      'Build Complete',
      'Ready for Installation',
      'Installing',
      'Completed'
    ].map(x=><option key={x} value={x}>{x}</option>)}
  </select>
</div>
    </div>

    <div className="cards buildDetailFacts" style={{marginTop:18}}>
      <div className="card">
        <div className="muted">Build Name</div>
        <div className="value" style={{fontSize:20}}>
          {selectedBuild.name||'—'}
        </div>
      </div>

  <div className="card">
  <div className="muted">Technician</div>

  <select
    value={selectedBuild.assigned_technician_id||''}
    onChange={e=>updateBuild(
      selectedBuild.id,
      {assigned_technician_id:e.target.value||null}
    )}
    style={{marginTop:8,width:'100%'}}
  >
    <option value="">Unassigned</option>

{employees
  .filter(e=>e.active)
  .map(e=>
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      )
    }
  </select>
</div>

<div className="card">
  <div className="muted">Installation Date</div>

  <input
    type="date"
    value={
      selectedBuild.installation_date
        ? buildDateValue(selectedBuild.installation_date)
        : ''
    }
    onChange={e=>updateBuild(
      selectedBuild.id,
      {installation_date:e.target.value||null}
    )}
    style={{marginTop:8,width:'100%'}}
  />
</div>
    </div>
    <div className="card" style={{marginTop:16}}>
  <h3>Build Notes</h3>

  <textarea
    value={selectedBuild.build_notes || ''}
    onChange={e =>
      setSelectedBuild({
        ...selectedBuild,
        build_notes:e.target.value
      })
    }
    onBlur={e =>
      updateBuild(
        selectedBuild.id,
        {build_notes:e.target.value}
      )
    }
    placeholder="Add build instructions, configuration details, issues, or other notes..."
    style={{
      width:'100%',
      minHeight:100,
      resize:'vertical'
    }}
  />
</div>
    <div className="card" style={{marginTop:16}}>
  <h3>Installation Notes</h3>

  <textarea
    value={selectedBuild.installation_notes || ''}
    onChange={e =>
      setSelectedBuild({
        ...selectedBuild,
        installation_notes:e.target.value
      })
    }
    onBlur={e =>
      updateBuild(
        selectedBuild.id,
        {installation_notes:e.target.value}
      )
    }
    placeholder="Add installation instructions, site access details, special requirements, or other notes..."
    style={{
      width:'100%',
      minHeight:100,
      resize:'vertical'
    }}
  />
</div>
    <TechnicianChecklist build={selectedBuild} order={order} assigned={buildItems} progress={checklistProgress} onToggle={toggleChecklistTask} saving={checklistSaving}/>
    <div className="panel buildPartsPanel" style={{marginTop:18}}>
  <div style={{marginBottom:12}}>
    <h2 style={{margin:0}}>Build Parts</h2>
    <div className="muted">
      Assign physical Sales Order items to this simulator.
    </div>
  </div>

  <div className="mobileCards buildPartCards">
    {(order?.order_items||[]).filter((i:any)=>i.item_type==='Product').map((i:any)=>{
      const assignment=buildItems.find(bi=>bi.build_id===selectedBuild.id&&bi.order_item_id===i.id);
      return <MobileBuildPartCard key={i.id} item={i} assignedQty={assignment?.qty||0} onSaveQty={qty=>{
        if(qty<=0)removeBuildItem(selectedBuild.id,i.id);
        else assignBuildItem(selectedBuild.id,i.id,qty);
      }}/>;
    })}
    {!(order?.order_items||[]).some((i:any)=>i.item_type==='Product')&&<div className="muted">No physical products are on this Sales Order.</div>}
  </div>
  <div className="desktopWorkTable buildPartsDesktopTable"><table>
    <thead>
      <tr>
        <th>Part</th>
        <th>SKU</th>
        <th>Ordered Qty</th>
        <th>Assigned to Build</th>
        <th>Purchasing Status</th>
        <th>Tracking</th>
      </tr>
    </thead>

    <tbody>
      {(order?.order_items||[])
        .filter((i:any)=>i.item_type==='Product')
        .map((i:any)=>{
          const assignment=buildItems.find(
            bi=>
              bi.build_id===selectedBuild.id &&
              bi.order_item_id===i.id
          );

          return (
            <tr key={i.id}>
              <td>
                <b>{i.description}</b>
                <div className="muted">{i.vendor||'—'}</div>
              </td>

              <td>{i.sku||'—'}</td>

              <td>{Number(i.qty)}</td>

              <td>
                <input
                  type="number"
                  min="0"
                  max={Number(i.qty)}
                  step="1"
                  value={assignment?.qty||0}
onChange={e=>{
  const qty=Number(e.target.value);

  if(qty<=0){
    removeBuildItem(
      selectedBuild.id,
      i.id
    );
  }else{
    assignBuildItem(
      selectedBuild.id,
      i.id,
      qty
    );
  }
}}
                  style={{width:80}}
                />
              </td>

              <td>{i.purchasing_status||'—'}</td>

              <td>{i.tracking||'—'}</td>
            </tr>
          );
        })}

      {!(order?.order_items||[])
        .some((i:any)=>i.item_type==='Product') &&
        <tr>
          <td colSpan={6} className="muted">
            No physical products are on this Sales Order.
          </td>
        </tr>
      }
    </tbody>
  </table></div>
</div>
  </section>
})()}
{tab==='Customers'&&<>
  <div
    className="row"
    style={{justifyContent:'space-between',marginBottom:12}}
  >
    <button
      className="btn"
      onClick={()=>setModal('customer')}
    >
      + New Customer
    </button>

    <div className="row">
      <input
        placeholder="Search customers..."
        value={customerSearch}
        onChange={e=>{
  setCustomerSearch(e.target.value);
  setCustomerPage(1);
}}
        onKeyDown={e=>{
          if(e.key==='Enter'){
            setCustomerPage(1);
            loadCustomersPage(1,customerSearch);
          }
        }}
        style={{padding:9,width:320}}
      />

      <button
        className="btn secondary"
        onClick={()=>{
          setCustomerPage(1);
          loadCustomersPage(1,customerSearch);
        }}
      >
        Search
      </button>
    </div>
  </div>

  <div className="panel">
    <h2>Customers</h2>

    <table>
      <tbody>
        {customers.map(c=>
          <tr
            key={c.id}
            onClick={()=>{
              setEditingCustomer(c);
              setModal('viewCustomer');
            }}
            onKeyDown={e=>{
              if(e.key==='Enter' || e.key===' '){
                e.preventDefault();
                setEditingCustomer(c);
                setModal('viewCustomer');
              }
            }}
            tabIndex={0}
            className="fx-row"
            aria-label={`View customer ${c.name}`}
            style={{cursor:'pointer'}}
          >
            <td><b>{c.name}</b></td>
            <td>{c.company}</td>
            <td>{c.email}</td>
            <td>{c.phone}</td>
            <td><span className="muted">View →</span></td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  <div
    className="row"
    style={{justifyContent:'space-between',marginTop:12}}
  >
    <div className="muted">
      {customerTotal === 0
        ? 'No customers found'
        : `${((customerPage-1)*CUSTOMERS_PER_PAGE)+1}–${Math.min(
            customerPage*CUSTOMERS_PER_PAGE,
            customerTotal
          )} of ${customerTotal}`
      }
    </div>

    <div className="row">
      <button
        className="btn secondary"
        disabled={customerPage===1}
        onClick={()=>setCustomerPage(p=>Math.max(1,p-1))}
      >
        Previous
      </button>

      <span>
        Page {customerPage} of {Math.max(
          1,
          Math.ceil(customerTotal/CUSTOMERS_PER_PAGE)
        )}
      </span>

      <button
        className="btn secondary"
        disabled={
          customerPage>=Math.ceil(
            customerTotal/CUSTOMERS_PER_PAGE
          )
        }
        onClick={()=>setCustomerPage(p=>p+1)}
      >
        Next
      </button>
    </div>
  </div>
</>}
{module==='Inventory'&&['Product Analytics','Vendor Analytics'].includes(tab)&&<div className="panel" style={{padding:16}}>
  <div className="row" style={{justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}>
    <div><h2 style={{margin:0}}>{tab}</h2><p className="muted" style={{margin:'5px 0'}}>Sales Order retail revenue, recorded line-item costs, and gross profit. Purchase Orders are not required.</p></div>
    <button type="button" className="btn secondary" disabled={forecastLoading} onClick={()=>void loadForecast()}>{forecastLoading?'Loading…':'Refresh Analytics'}</button>
  </div>
  {forecastError&&<p role="alert" style={{color:'#b91c1c'}}>Unable to load analytics: {forecastError}</p>}
  <div className="row" style={{gap:10,flexWrap:'wrap',marginBottom:14}}>
    <select aria-label="Reporting period" value={analyticsPeriod} onChange={e=>{setAnalyticsPeriod(e.target.value);setAnalyticsPage(1);setAnalyticsSelected(null)}}>
      <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option><option value="all">All time</option>
    </select>
    <input aria-label="Search analytics" placeholder={analyticsIsVendor?'Search vendor or product…':'Search product, SKU, or vendor…'} value={analyticsSearch} onChange={e=>{setAnalyticsSearch(e.target.value);setAnalyticsPage(1)}} style={{minWidth:220,flex:'1 1 220px'}}/>
  </div>
  {(()=>{const totalRevenue=analyticsLines.reduce((sum,l)=>sum+l.revenue,0);const totalCost=analyticsLines.reduce((sum,l)=>sum+(l.cost||0),0);const missing=analyticsLines.filter(l=>l.cost===null).length;const cards=[['Retail Revenue',analyticsMoney(totalRevenue)],['Recorded Cost',missing?'Incomplete':analyticsMoney(totalCost)],['Gross Profit',missing?'Incomplete':analyticsMoney(totalRevenue-totalCost)],['Gross Margin',missing?'Incomplete':totalRevenue?`${((totalRevenue-totalCost)/totalRevenue*100).toFixed(1)}%`:'—']];return <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>{cards.map(([label,value])=><div key={label} style={{border:'1px solid #ddd',padding:'10px 14px',borderRadius:6,minWidth:160,flex:'1 1 160px'}}><div className="muted">{label}</div><b style={{fontSize:20}}>{value}</b></div>)}</div>})()}
  <p className="muted" style={{fontSize:12}}>Includes non-draft, non-canceled Sales Orders; figures are based on saved line-item prices and costs, excluding tax and shipping. Discounts and refunds are not allocated to individual products or vendors. Missing costs are not treated as zero. {forecastUpdated?`Refreshed ${forecastUpdated.toLocaleTimeString()}.`:''}</p>
  {analyticsDetail?<div style={{marginTop:16}}>
    <button type="button" className="btn secondary" onClick={()=>{setAnalyticsSelected(null);setAnalyticsDetailPage(1)}} style={{marginBottom:12}}>← All {analyticsIsVendor?'Vendors':'Products'}</button>
    <h3>{analyticsDetail.name}</h3>
    <div className="row" style={{gap:14,flexWrap:'wrap',marginBottom:12}}><span><b>{analyticsDetail.units}</b> units</span><span><b>{analyticsMoney(analyticsDetail.revenue)}</b> revenue</span><span><b>{analyticsDetail.orders.size}</b> orders</span><span>Last sale: <b>{analyticsDetail.lastSale||'—'}</b></span></div>
    <div className="row" style={{gap:14,flexWrap:'wrap',marginBottom:16}}><span>Our cost: <b>{analyticsDetail.missingCosts?'Incomplete':analyticsMoney(analyticsDetail.cost)}</b></span><span>Gross profit: <b>{analyticsDetail.missingCosts?'Incomplete':analyticsMoney(analyticsDetail.revenue-analyticsDetail.cost)}</b></span><span>Margin: <b>{analyticsDetail.missingCosts?'Incomplete':analyticsDetail.revenue?`${((analyticsDetail.revenue-analyticsDetail.cost)/analyticsDetail.revenue*100).toFixed(1)}%`:'—'}</b></span></div>
    <h3>Monthly Sales</h3>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>Month</th><th style={{textAlign:'right'}}>Units</th><th style={{textAlign:'right'}}>Revenue</th></tr></thead><tbody>{Object.entries(analyticsDetail.months).sort(([a],[b])=>b.localeCompare(a)).map(([month,v])=><tr key={month}><td>{month}</td><td style={{textAlign:'right'}}>{v.units}</td><td style={{textAlign:'right'}}>{analyticsMoney(v.revenue)}</td></tr>)}</tbody></table></div>
    {analyticsIsVendor&&<><h3 style={{marginTop:20}}>Products Sold by Vendor</h3><div style={{overflowX:'auto'}}><table><thead><tr><th>Product</th><th style={{textAlign:'right'}}>Units</th><th style={{textAlign:'right'}}>Revenue</th></tr></thead><tbody>{(()=>{const byProduct=new Map<string,{name:string,units:number,revenue:number}>();for(const l of analyticsDetailLines){const row=byProduct.get(l.productKey)||{name:l.product,units:0,revenue:0};row.units+=l.qty;row.revenue+=l.revenue;byProduct.set(l.productKey,row);}return [...byProduct.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).map(([key,row])=><tr key={key}><td>{row.name}</td><td style={{textAlign:'right'}}>{row.units}</td><td style={{textAlign:'right'}}>{analyticsMoney(row.revenue)}</td></tr>);})()}</tbody></table></div></>}
    <h3 style={{marginTop:20}}>Sales Order History</h3>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>Date</th><th>Sales Order</th><th>Product</th><th style={{textAlign:'right'}}>Qty</th><th style={{textAlign:'right'}}>Retail</th><th style={{textAlign:'right'}}>Our Cost</th><th style={{textAlign:'right'}}>Gross Profit</th></tr></thead><tbody>{analyticsDetailLines.slice((analyticsSafeDetailPage-1)*LIST_PAGE_SIZE,analyticsSafeDetailPage*LIST_PAGE_SIZE).map(l=><tr key={l.id}><td>{l.date}</td><td>{l.orderNumber}</td><td>{l.product}</td><td style={{textAlign:'right'}}>{l.qty}</td><td style={{textAlign:'right'}}>{analyticsMoney(l.revenue)}</td><td style={{textAlign:'right'}}>{l.cost===null?'Missing':analyticsMoney(l.cost)}</td><td style={{textAlign:'right'}}>{l.cost===null?'—':analyticsMoney(l.revenue-l.cost)}</td></tr>)}</tbody></table></div>
    <ListPagination page={analyticsSafeDetailPage} onPageChange={setAnalyticsDetailPage} total={analyticsDetailLines.length}/>
  </div>:<>
    <div style={{overflowX:'auto'}}><table style={{minWidth:860,width:'100%'}}><thead><tr><th>{analyticsIsVendor?'Vendor':'Product'}</th><th style={{textAlign:'right'}}>Units Sold</th><th style={{textAlign:'right'}}>Orders</th><th style={{textAlign:'right'}}>Retail Revenue</th><th style={{textAlign:'right'}}>Our Cost</th><th style={{textAlign:'right'}}>Gross Profit</th><th style={{textAlign:'right'}}>Margin</th><th>Last Sale</th></tr></thead><tbody>{analyticsRows.slice((analyticsSafePage-1)*LIST_PAGE_SIZE,analyticsSafePage*LIST_PAGE_SIZE).map(row=><tr key={row.key} onClick={()=>{setAnalyticsSelected(row.key);setAnalyticsDetailPage(1)}} style={{cursor:'pointer'}} title="View sales history"><td><b>{row.name}</b></td><td style={{textAlign:'right'}}>{row.units}</td><td style={{textAlign:'right'}}>{row.orders.size}</td><td style={{textAlign:'right'}}>{analyticsMoney(row.revenue)}</td><td style={{textAlign:'right'}}>{row.missingCosts?'Incomplete':analyticsMoney(row.cost)}</td><td style={{textAlign:'right'}}>{row.missingCosts?'Incomplete':analyticsMoney(row.revenue-row.cost)}</td><td style={{textAlign:'right'}}>{row.missingCosts?'—':row.revenue?`${((row.revenue-row.cost)/row.revenue*100).toFixed(1)}%`:'—'}</td><td>{row.lastSale}</td></tr>)}{!forecastLoading&&analyticsRows.length===0&&<tr><td colSpan={8} className="muted" style={{textAlign:'center',padding:20}}>No qualifying sales found.</td></tr>}</tbody></table></div>
    <ListPagination page={analyticsSafePage} onPageChange={setAnalyticsPage} total={analyticsRows.length}/>
  </>}
</div>}
{module==='Inventory'&&tab==='Inventory Forecast'&&<div className="panel" style={{padding:16}}>
  <div className="row" style={{justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:14}}>
    <div><h2 style={{margin:0}}>Inventory Forecast</h2><p className="muted" style={{margin:'5px 0'}}>Corbeau-style product demand reporting. Physical stock tracking is not active.</p></div>
    <button type="button" className="btn secondary" onClick={()=>void loadForecast()} disabled={forecastLoading}>{forecastLoading?'Loading…':'Refresh Sales History'}</button>
  </div>
  {forecastError&&<p role="alert" style={{color:'#b91c1c'}}>Sales history could not be loaded: {forecastError}</p>}
  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
    <div style={{border:'1px solid #ddd',padding:'10px 14px',borderRadius:6,minWidth:145}}><div className="muted">Products Sold</div><b style={{fontSize:20}}>{forecastRows.filter(r=>r.total>0).length}</b></div>
    <div style={{border:'1px solid #ddd',padding:'10px 14px',borderRadius:6,minWidth:145}}><div className="muted">Units Sold (90 days)</div><b style={{fontSize:20}}>{forecastRows.reduce((a,r)=>a+r.last90,0).toLocaleString()}</b></div>
    <div style={{border:'1px solid #ddd',padding:'10px 14px',borderRadius:6,minWidth:145}}><div className="muted">Monthly Demand (90-day avg.)</div><b style={{fontSize:20}}>{(forecastRows.reduce((a,r)=>a+r.last90,0)/3).toFixed(1)}</b></div>
    <div style={{border:'1px solid #ddd',padding:'10px 14px',borderRadius:6,minWidth:145}}><div className="muted">Inventory Tracking</div><b>Inactive</b></div>
  </div>
  <div className="row" style={{gap:10,flexWrap:'wrap',marginBottom:12}}>
    <input aria-label="Search forecast products" placeholder="Search SKU, product, or vendor…" value={forecastSearch} onChange={e=>setForecastSearch(e.target.value)} style={{minWidth:220,flex:'1 1 220px'}}/>
    <select aria-label="Vendor" value={forecastVendor} onChange={e=>setForecastVendor(e.target.value)}><option value="All">All Vendors</option>{[...new Set(forecastRows.map(r=>r.vendor))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select>
    <select aria-label="Sales period" value={forecastPeriod} onChange={e=>setForecastPeriod(e.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></select>
  </div>
  <p className="muted" style={{fontSize:12,margin:'0 0 10px'}}>Sales quantities use confirmed Sales Order product lines (excluding canceled orders), based on order date. Build assignments are not counted again. {forecastUpdated?`Last refreshed ${forecastUpdated.toLocaleTimeString()}.`:''}</p>
  <div style={{overflowX:'auto'}}><table style={{minWidth:1120,width:'100%'}}><thead><tr><th>SKU</th><th>Product</th><th>Vendor</th><th style={{textAlign:'right'}}>Total Sold</th><th style={{textAlign:'right'}}>30 Days</th><th style={{textAlign:'right'}}>90 Days</th><th style={{textAlign:'right'}}>365 Days</th><th style={{textAlign:'right'}}>Monthly Avg.</th><th style={{textAlign:'right'}}>Next 30d*</th><th style={{textAlign:'center'}}>On Hand</th><th style={{textAlign:'center'}}>Incoming</th><th style={{textAlign:'center'}}>Supply</th></tr></thead><tbody>
    {filteredForecastRows.slice((safeForecastPage-1)*LIST_PAGE_SIZE,safeForecastPage*LIST_PAGE_SIZE).map(r=><tr key={r.key}><td>{r.sku}</td><td>{r.name}</td><td>{r.vendor}</td><td style={{textAlign:'right'}}>{r.total}</td><td style={{textAlign:'right'}}>{r.last30}</td><td style={{textAlign:'right'}}>{r.last90}</td><td style={{textAlign:'right'}}>{r.last365}</td><td style={{textAlign:'right'}}>{r.monthly.toFixed(1)}</td><td style={{textAlign:'right'}}>{r.forecast30.toFixed(1)}</td><td style={{textAlign:'center'}} className="muted">—</td><td style={{textAlign:'center'}} className="muted">—</td><td style={{textAlign:'center'}} className="muted">—</td></tr>)}
    {!forecastLoading&&filteredForecastRows.length===0&&<tr><td colSpan={12} className="muted" style={{textAlign:'center',padding:20}}>No confirmed product sales found.</td></tr>}
  </tbody></table></div>
  <ListPagination page={safeForecastPage} onPageChange={setForecastPage} total={filteredForecastRows.length}/>
  <p className="muted" style={{fontSize:12,marginTop:12}}>*Simple demand estimate using the last 90 days divided by three; not a purchase recommendation. On Hand, Incoming, and Supply are intentionally blank until stock tracking is enabled. This report does not change stock or orders.</p>
</div>}
{tab==='Products'&&<>
<div className="row" style={{justifyContent:'space-between',marginBottom:12}}>
  <div className="row">
    <b>Product catalog</b>
    <span className="muted">
      Price Guide sync will update this catalog; historical orders remain unchanged.
    </span>
  </div>

  <button className="btn" onClick={syncPriceGuide}>
    Sync Price Guide
  </button>
</div>

<div className="row" style={{marginBottom:12}}>
  <input
    placeholder="Search name, SKU, vendor, or category..."
    value={productSearch}
    onChange={e=>{
      setProductSearch(e.target.value);
      setProductPage(1);
    }}
    style={{padding:9,width:320}}
  />
  <select
  value={productCategoryFilter}
  onChange={e=>{
    setProductCategoryFilter(e.target.value);
    setProductPage(1);
  }}
  style={{padding:9}}
>
  <option value="All">All Categories</option>
  {[...new Set(products.map(p=>p.category).filter((category): category is string => Boolean(category)))]
    .sort()
    .map(category=>
      <option key={category} value={category}>
        {category}
      </option>
    )}
</select>
</div>
  <div className="panel"><table><thead><tr><th>SKU</th><th>Product</th><th>Vendor</th><th>Category</th><th className="fx-num">Sell</th><th className="fx-num">Cost</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.sku}</td><td><b>{p.name}</b></td><td>{p.vendor}</td><td>{p.category}</td><td className="fx-num">{fmtMoney(Number(p.sell_price))}</td><td className="fx-num">{p.cost==null?'—':fmtMoney(Number(p.cost))}</td></tr>)}</tbody></table></div>
<div
  className="row"
  style={{justifyContent:'space-between',marginTop:12}}
>
  <div className="muted">
    {productTotal === 0
      ? 'No products found'
      : `${((productPage-1)*PRODUCTS_PER_PAGE)+1}–${Math.min(
          productPage*PRODUCTS_PER_PAGE,
          productTotal
        )} of ${productTotal}`
    }
  </div>

  <div className="row">
    <button
      className="btn secondary"
      disabled={productPage===1}
      onClick={()=>setProductPage(p=>Math.max(1,p-1))}
    >
      Previous
    </button>

    <span>
      Page {productPage} of {Math.max(
        1,
        Math.ceil(productTotal/PRODUCTS_PER_PAGE)
      )}
    </span>

    <button
      className="btn secondary"
      disabled={
        productPage>=Math.ceil(
          productTotal/PRODUCTS_PER_PAGE
        )
      }
      onClick={()=>setProductPage(p=>p+1)}
    >
      Next
    </button>
  </div>
</div>
</>}
{(tab==='Orders'||tab==='Quotations')&&<>
  <div className="row" style={{justifyContent:'space-between',marginBottom:12}}>
    <button
      className="btn"
      onClick={()=>{setQuotationCustomerName('');setQuotationCustomerId('');setQuickCustomerOpen(false);setModal('order')}}
    >
      {tab==='Quotations'?'+ New Quotation':'+ New Quotation'}
    </button>

    <div className="row">
      <input
        placeholder="Search order or reference #..."
        value={orderSearch}
        onChange={e=>{
  setOrderSearch(e.target.value);
  setOrderPage(1);
}}
        onKeyDown={e=>{
          if(e.key==='Enter'){
            setOrderPage(1);
            loadOrdersPage(1,orderSearch,orderStatusFilter);
          }
        }}
      />

      {tab==='Orders'&&<select
        value={orderStatusFilter}
        onChange={e=>{
          setOrderStatusFilter(e.target.value);
          setOrderPage(1);
        }}
      >
        <option value="All">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
        <option value="Parts Ordering">Parts Ordering</option>
        <option value="Parts Ordered">Parts Ordered</option>
        <option value="Build Ready">Build Ready</option>
        <option value="Building">Building</option>
        <option value="Ready for Installation">Ready for Installation</option>
        <option value="Completed">Completed</option>
      </select>}
    </div>
  </div>

  <div className="panel">
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Reference #</th>
          <th>Customer</th>
          <th>Status</th>
          <th className="fx-num">Total</th>
        </tr>
      </thead>

      <tbody>
        {orders.map(o=>
          <tr
            key={o.id}
            className="fx-row"
            onClick={()=>{
              setSelected(o);
              setTab('Order');
            }}
            style={{cursor:'pointer'}}
          >
            <td><b className="fx-link">{o.order_number}</b></td>
            <td>{o.reference_number||'—'}</td>
            <td>{(o.customers as any)?.name}</td>
            <td><StatusBadge status={o.status}/></td>
            <td className="fx-num">{fmtMoney(totals(o).sell)}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  <div
    className="row"
    style={{justifyContent:'space-between',marginTop:12}}
  >
    <div className="muted">
      {orderTotal === 0
        ? 'No orders found'
        : `${((orderPage-1)*ORDERS_PER_PAGE)+1}–${Math.min(
            orderPage*ORDERS_PER_PAGE,
            orderTotal
          )} of ${orderTotal}`
      }
    </div>

    <div className="row">
      <button
        className="btn secondary"
        disabled={orderPage===1}
        onClick={()=>setOrderPage(p=>Math.max(1,p-1))}
      >
        Previous
      </button>

      <span>
        Page {orderPage} of {Math.max(
          1,
          Math.ceil(orderTotal/ORDERS_PER_PAGE)
        )}
      </span>

      <button
        className="btn secondary"
        disabled={orderPage>=Math.ceil(orderTotal/ORDERS_PER_PAGE)}
        onClick={()=>setOrderPage(p=>p+1)}
      >
        Next
      </button>
    </div>
  </div>
</>}
      {tab==='Purchasing'&&<PurchasingView orders={confirmedOrders} updateItem={updateItem} createPurchaseOrder={createPurchaseOrder} openOrder={(o:any)=>{setSelected(o);setSelectedPO(null);setTab('Order')}}/>}
{tab==='Purchase Orders'&&<PurchaseOrdersView purchaseOrders={purchaseOrders} openPO={(po:any)=>{setSelectedPO(po);setSelected(null);setTab('Purchase Order')}}/>}
{tab==='Purchase Order'&&selectedPO&&<PurchaseOrderView po={selectedPO} back={()=>{setSelectedPO(null);setTab('Purchase Orders')}}/>}
{tab==='Order'&&selected&&<OrderView o={selected} products={products} totals={totals(selected)} addProduct={addProduct} addOther={()=>setModal('other')} openInvoice={openInvoice} openQuote={()=>setTab('Quote')} dup={dup} del={del} updateItem={updateItem} updateOrderDetails={updateOrderDetails} updateOrderStatus={updateOrderStatus} createPurchaseOrder={createPurchaseOrder} purchaseOrders={purchaseOrders} openPO={(po:any)=>{setSelectedPO(po);setTab('Purchase Order')}} addOrderNote={addOrderNote} createBuild={createBuild} builds={builds} openBuild={(b:Build)=>{setSelectedBuild(b);setModule('Builds');setTab('Build');}}/>}
{tab==='Quote'&&selected&&selected.status==='Draft'&&<InvoiceView quote o={selected} totals={totals(selected)} back={()=>setTab('Order')} addPayment={()=>{}} adjustPayment={()=>{}}/>}
{tab==='Invoice'&&selected&&<InvoiceView o={selected} totals={totals(selected)} back={()=>setTab('Order')} addPayment={()=>setModal('payment')} adjustPayment={(p:Payment)=>{setAdjustmentPayment(p);setModal('adjustment')}}/>} </div></main>
{modal&&<div className="modalbg" onMouseDown={()=>setModal('')}><div className="modal" onMouseDown={e=>e.stopPropagation()}>{modal==='employee-new'&&<form action={createEmployee}>
  <h2>New Employee</h2>

  <div className="grid">
    <div className="field">
      <label>Name</label>
      <input name="name" required/>
    </div>

    <div className="field">
      <label>Job Title</label>
      <input name="job_title"/>
    </div>

    <div className="field">
      <label>Email</label>
      <input name="email" type="email"/>
    </div>

    <div className="field">
      <label>Phone</label>
      <input name="phone"/>
    </div>

    <div className="field">
      <label>Role</label>
      <select name="role" defaultValue="Employee">
        <option value="Admin">Admin</option>
        <option value="Manager">Manager</option>
        <option value="Employee">Employee</option>
        <option value="Technician">Technician</option>
      </select>
    </div>
  </div>

  <div className="field">
    <label>Notes</label>
    <textarea name="notes" rows={4}/>
  </div>

  <div className="muted" style={{marginBottom:12}}>
    New employees are created as Active with ERP Access Off.
  </div>

  <div className="row">
    <button className="btn">Create Employee</button>
    <button
      type="button"
      className="btn secondary"
      onClick={()=>setModal('')}
    >
      Cancel
    </button>
  </div>
</form>}{modal==='customer'&&<form action={createCustomer}><h2>New Customer</h2><div className="grid">{['name','company','email','phone'].map(n=><div className="field" key={n}><label>{n}</label><input name={n} required={n==='name'}/></div>)}</div><button className="btn">Create Customer</button></form>} {modal==='viewCustomer'&&editingCustomer&&
<div>
  <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
    <h2 style={{margin:0}}>Customer Details</h2>
    <button type="button" className="btn" onClick={()=>setModal('editCustomer')}>
      Edit Customer
    </button>
  </div>
  <div className="grid">
    {([
      ['Name',editingCustomer.name],
      ['Company',editingCustomer.company],
      ['Email',editingCustomer.email],
      ['Phone',editingCustomer.phone],
      ['Billing Address',editingCustomer.billing_address],
      ['Shipping Address',editingCustomer.shipping_address]
    ] as [string,string|null|undefined][]).map(([label,value])=>
      <div className="field" key={label}>
        <label>{label}</label>
        <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'8px 0'}}>
          {value || '—'}
        </div>
      </div>
    )}
  </div>
  <div className="field">
    <label>Customer Notes</label>
    <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'8px 0'}}>
      {editingCustomer.notes || '—'}
    </div>
  </div>
  <div className="row" style={{marginTop:18}}>
    <button type="button" className="btn secondary" onClick={()=>{
      setModal('');
      setEditingCustomer(null);
    }}>Close</button>
  </div>
</div>} {modal==='editCustomer'&&editingCustomer&&
<form action={updateCustomer}>
  <h2>Edit Customer</h2>

  <input type="hidden" name="id" value={editingCustomer.id}/>

  <div className="grid">
    <div className="field">
      <label>Name</label>
      <input name="name" defaultValue={editingCustomer.name} required/>
    </div>

    <div className="field">
      <label>Company</label>
      <input name="company" defaultValue={editingCustomer.company||''}/>
    </div>

    <div className="field">
      <label>Email</label>
      <input name="email" type="email" defaultValue={editingCustomer.email||''}/>
    </div>

    <div className="field">
      <label>Phone</label>
      <input name="phone" defaultValue={editingCustomer.phone||''}/>
    </div>

    <div className="field">
      <label>Billing Address</label>
      <textarea name="billing_address" rows={3} defaultValue={editingCustomer.billing_address||''}/>
    </div>

    <div className="field">
      <label>Shipping Address</label>
      <textarea name="shipping_address" rows={3} defaultValue={editingCustomer.shipping_address||''}/>
    </div>
  </div>

  <div className="field">
    <label>Customer Notes</label>
    <textarea name="notes" rows={4} defaultValue={editingCustomer.notes||''}/>
  </div>

  <div className="row">
    <button className="btn">Save Customer</button>
    <button
      type="button"
      className="btn secondary"
      onClick={()=>setModal('viewCustomer')}
    >
      Cancel
    </button>
  </div>
</form>}{modal==='viewEmployee'&&editingEmployee&&<div>
  <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
    <h2 style={{margin:0}}>Employee Details</h2>
    <button type="button" className="btn" onClick={()=>setModal('employee')}>
      Edit Employee
    </button>
  </div>
  <div className="grid">
    {([
      ['Name',editingEmployee.name],
      ['Job Title',editingEmployee.job_title],
      ['Email',editingEmployee.email],
      ['Phone',editingEmployee.phone],
      ['Role',editingEmployee.role],
      ['ERP Access',editingEmployee.erp_access?'On':'Off'],
      ['Employment Status',editingEmployee.active?'Active':'Inactive'],
      ['ERP Login',editingEmployee.account_activated_at?'ERP Account Active':editingEmployee.user_id?'ERP Invitation Pending':'No ERP Account']
    ] as [string,string|null|undefined][]).map(([label,value])=>
      <div className="field" key={label}>
        <label>{label}</label>
        <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'8px 0'}}>
          {value||'—'}
        </div>
      </div>
    )}
  </div>
  <div className="field">
    <label>Employee Notes</label>
    <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:'8px 0'}}>
      {editingEmployee.notes||'—'}
    </div>
  </div>
  <div className="row" style={{marginTop:18}}>
    <button type="button" className="btn secondary" onClick={()=>{
      setModal('');
      setEditingEmployee(null);
    }}>Close</button>
  </div>
</div>}
{modal==='employee'&&editingEmployee&&<form action={updateEmployee}>
  <h2>Edit Employee</h2>

  <div className="grid">
    <div className="field">
      <label>Name</label>
      <input name="name" defaultValue={editingEmployee.name} required/>
    </div>

    <div className="field">
      <label>Job Title</label>
      <input name="job_title" defaultValue={editingEmployee.job_title||''}/>
    </div>

    <div className="field">
      <label>Email</label>
      <input name="email" type="email" defaultValue={editingEmployee.email||''}/>
    </div>

    <div className="field">
      <label>Phone</label>
      <input name="phone" defaultValue={editingEmployee.phone||''}/>
    </div>

    <div className="field">
  <label>Role</label>
  <select name="role" defaultValue={editingEmployee.role}>
    <option value="Admin">Admin</option>
    <option value="Manager">Manager</option>
    <option value="Employee">Employee</option>
    <option value="Technician">Technician</option>
  </select>
</div>
    <div className="field">
  <label>ERP Access</label>
  <select name="erp_access" defaultValue={editingEmployee.erp_access?'true':'false'}>
    <option value="true">On</option>
    <option value="false">Off</option>
  </select>
</div>

<div className="field">
  <label>Employment Status</label>
  <select name="active" defaultValue={editingEmployee.active?'true':'false'}>
    <option value="true">Active</option>
    <option value="false">Inactive</option>
  </select>
</div>
<div className="field" style={{gridColumn:'1 / -1'}}>
  <label>ERP Login</label>

  <div
    style={{
      border:'1px solid #dce0d9',
      borderRadius:6,
      padding:14
    }}
  >
    <div style={{marginBottom:10}}>
      <b>
        {editingEmployee.account_activated_at
          ? 'ERP Account Active'
          : editingEmployee.user_id
            ? 'ERP Invitation Pending'
            : 'No ERP Account'}
      </b>

      <div className="muted" style={{marginTop:4}}>
        {editingEmployee.account_activated_at
          ? 'This employee has an active login account connected to the ERP.'
          : editingEmployee.user_id
            ? 'This employee has been invited but has not completed account setup yet.'
            : 'This employee does not have a login account yet.'}
      </div>
    </div>

    {editingEmployee.active &&
      !editingEmployee.account_activated_at && (
        <button
          type="button"
          className="btn secondary"
          onClick={()=>inviteEmployee(editingEmployee)}
        >
          {editingEmployee.user_id
            ? 'Resend Invite'
            : 'Invite to ERP'}
        </button>
      )}
  </div>
</div>
    </div>

  <div className="field">
    <label>Employee Notes</label>
    <textarea name="notes" rows={4} defaultValue={editingEmployee.notes||''}/>
  </div>

  <div className="row">
    <button className="btn">Save Employee</button>
    <button
      type="button"
      className="btn secondary"
      onClick={()=>setModal('viewEmployee')}
    >
      Cancel
    </button>
  </div>
</form>}
{modal==='order'&&<>
  <form action={createOrder} style={{display:quickCustomerOpen?'none':undefined}}>
    <h2>New Quotation</h2>
    <div className="grid">
      <div className="field" style={{gridColumn:'span 2'}}>
        <label>Customer</label>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input
            list="quotation-customers"
            placeholder="Type to search"
            value={quotationCustomerName}
            onChange={e=>{
              const value=e.target.value;
              const match=customers.find(c=>c.name===value);
              setQuotationCustomerName(value);
              setQuotationCustomerId(match?.id||'');
            }}
            style={{minWidth:0,flex:1}}
          />
          <button type="button" className="btn secondary"
            onClick={()=>setQuickCustomerOpen(true)}
            style={{whiteSpace:'nowrap',padding:'9px 10px'}}>
            + New Customer
          </button>
        </div>
        <datalist id="quotation-customers">
          {customers.map(c=><option key={c.id} value={c.name}>{c.company||c.email||''}</option>)}
        </datalist>
        <input name="customer_id" type="hidden" value={quotationCustomerId} readOnly/>
      </div>
      <div className="field"><label>Reference #</label><input name="reference_number" placeholder="e.g. PO Mansell"/></div>
      <div className="field"><label>Order Date</label><input name="order_date" type="date" required defaultValue={(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})()}/></div>
      <div className="field"><label>Tax Rate %</label><input name="tax_rate" type="number" step=".01" defaultValue="7.45"/></div>
    </div>
    <p className="muted">Total is calculated from order items.</p>
    <button className="btn">Create Quotation</button>
  </form>
  {quickCustomerOpen&&<form action={createQuotationCustomer}>
    <h2>Add New Customer</h2>
    <div className="grid">
      <div className="field"><label>Name *</label><input name="name" required autoFocus/></div>
      <div className="field"><label>Company</label><input name="company"/></div>
      <div className="field"><label>Email</label><input name="email" type="email"/></div>
      <div className="field"><label>Phone</label><input name="phone"/></div>
      <div className="field"><label>Billing Address</label><textarea name="billing_address" rows={2}/></div>
      <div className="field"><label>Shipping Address</label><textarea name="shipping_address" rows={2}/></div>
    </div>
    <div className="field"><label>Notes</label><textarea name="notes" rows={3}/></div>
    <div className="row" style={{justifyContent:'flex-end',marginTop:12}}>
      <button type="button" className="btn secondary" disabled={quickCustomerSaving} onClick={()=>setQuickCustomerOpen(false)}>Cancel</button>
      <button className="btn" disabled={quickCustomerSaving}>{quickCustomerSaving?'Saving...':'Save Customer'}</button>
    </div>
  </form>}
</>}
{modal==='other'&&<form action={addOther}><h2>Add Labor / Other</h2><div className="grid"><div className="field"><label>Type</label><select name="item_type"><option>Labor/Service</option><option>Shipping</option><option>Miscellaneous</option><option>Discount</option></select></div><div className="field"><label>Description</label><input name="description" required/></div><div className="field"><label>Qty</label><input name="qty" type="number" defaultValue="1"/></div><div className="field"><label>Sell Price</label><input name="sell_price" type="number" step=".01" required/></div><div className="field"><label>Internal Cost</label><input name="cost" type="number" step=".01" placeholder="Optional"/></div></div><button className="btn">Add Item</button></form>}{modal==='adjustment'&&selected&&adjustmentPayment&&<PaymentAdjustmentForm payment={adjustmentPayment} adjustments={(selected.payment_adjustments||[]).filter(a=>a.payment_id===adjustmentPayment.id)} submit={recordAdjustment}/>}
{modal==='payment'&&selected&&<form action={addPayment}><h2>Record Payment</h2><p className="muted">Remaining balance: ${Math.max(0,Math.round(((selected.order_items||[]).reduce((sum,i)=>sum+Number(i.qty)*Number(i.sell_price),0)*(1+(selected.tax_exempt?0:Number(selected.tax_rate||0)/100))+Number(selected.shipping_amount||0)-(selected.payments||[]).reduce((sum,p)=>sum+Number(p.amount),0)+(selected.payment_adjustments||[]).reduce((sum,a)=>sum+Number(a.amount),0))*100)/100).toFixed(2)}</p><div className="grid"><div className="field"><label>Amount</label><input name="amount" type="number" step=".01" min="0.01" defaultValue={Math.max(0,Math.round(((selected.order_items||[]).reduce((sum,i)=>sum+Number(i.qty)*Number(i.sell_price),0)*(1+(selected.tax_exempt?0:Number(selected.tax_rate||0)/100))+Number(selected.shipping_amount||0)-(selected.payments||[]).reduce((sum,p)=>sum+Number(p.amount),0)+(selected.payment_adjustments||[]).reduce((sum,a)=>sum+Number(a.amount),0))*100)/100)>0?Math.max(0,Math.round(((selected.order_items||[]).reduce((sum,i)=>sum+Number(i.qty)*Number(i.sell_price),0)*(1+(selected.tax_exempt?0:Number(selected.tax_rate||0)/100))+Number(selected.shipping_amount||0)-(selected.payments||[]).reduce((sum,p)=>sum+Number(p.amount),0)+(selected.payment_adjustments||[]).reduce((sum,a)=>sum+Number(a.amount),0))*100)/100).toFixed(2):''} required/></div><div className="field"><label>Payment Date</label><input name="paid_at" type="date" defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)} required/></div><div className="field"><label>Payment Method</label><select name="payment_method"><option>Credit Card</option><option>ACH</option><option>Wire</option><option>Check</option><option>Cash</option><option>Other</option></select></div><div className="field"><label>Reference / Confirmation</label><input name="reference"/></div></div><div className="field"><label>Notes</label><input name="notes"/></div><button className="btn">Record Payment</button></form>}</div></div>}</div>}
  
function PurchasingNotesCell({item,updateItem}:{item:Item,updateItem:(item:Item,key:string,value:any)=>Promise<void>}){
  const [expanded,setExpanded]=useState(false);
  const [draft,setDraft]=useState(item.purchasing_notes||'');
  useEffect(()=>{if(!expanded)setDraft(item.purchasing_notes||'');},[item.purchasing_notes,expanded]);
  return <div style={{minWidth:125,maxWidth:220}}>
    <button type="button" className="btn ghost" style={{textAlign:'left',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} onClick={()=>setExpanded(v=>!v)} title={item.purchasing_notes||'Add purchasing note'}>
      {item.purchasing_notes||'+ Add note'}
    </button>
    {expanded&&<div style={{minWidth:230,marginTop:6}}>
      <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder="Vendor update, backorder details..." style={{width:'100%',resize:'vertical'}} onBlur={()=>{if(draft!==(item.purchasing_notes||''))void updateItem(item,'purchasing_notes',draft.trim()||null);}}/>
      <div className="muted" style={{fontSize:11}}>Autosaves when you leave the field</div>
    </div>}
  </div>;
}
function PurchasingFields({item,updateItem}:{item:Item,updateItem:(item:Item,key:string,value:any)=>Promise<void>}){
  return <>
    <td><input key={`${item.id}-vendor-${item.vendor_order_number||''}`} defaultValue={item.vendor_order_number||''} placeholder="Vendor Order #" onBlur={e=>{const v=e.target.value.trim();if(v!==(item.vendor_order_number||''))void updateItem(item,'vendor_order_number',v||null);}} style={{width:135}}/></td>
    <td><input key={`${item.id}-eta-${item.eta_date||''}`} type="date" defaultValue={item.eta_date||''} aria-label="Expected arrival date" onChange={e=>{if(e.target.value!==(item.eta_date||''))void updateItem(item,'eta_date',e.target.value||null);}} style={{width:145}}/></td>
    <td><input key={`${item.id}-tracking-${item.tracking||''}`} defaultValue={item.tracking||''} placeholder="Tracking #" onBlur={e=>{if(e.target.value!==(item.tracking||''))void updateItem(item,'tracking',e.target.value||null);}} style={{minWidth:150,width:165}}/></td>
    <td><PurchasingNotesCell item={item} updateItem={updateItem}/></td>
  </>;
}
function MobileBuildPartCard({item,assignedQty,onSaveQty}:{item:Item,assignedQty:number,onSaveQty:(qty:number)=>void}){
  const [draft,setDraft]=useState(String(assignedQty));
  useEffect(()=>setDraft(String(assignedQty)),[assignedQty,item.id]);
  const max=Math.max(0,Number(item.qty)||0);
  const save=()=>{
    const parsed=Number(draft);
    if(!Number.isFinite(parsed)){setDraft(String(assignedQty));return;}
    const qty=Math.max(0,Math.min(max,Math.floor(parsed)));
    setDraft(String(qty));
    if(qty!==Number(assignedQty))onSaveQty(qty);
  };
  return <div className="mobileWorkCard">
    <div className="mobileCardHeading"><b>{item.description}</b><span className="mobileStatus">{item.purchasing_status||'—'}</span></div>
    <div className="mobileSubline muted">{item.vendor||'No vendor'}{item.sku?` · ${item.sku}`:''}</div>
    <div className="mobileFacts"><div><small>Ordered Quantity</small><strong>{item.qty}</strong></div><div><small>Tracking</small><strong>{item.tracking||'—'}</strong></div></div>
    <label className="mobileBuildQtyLabel">Assigned to this Build
      <input type="number" inputMode="numeric" min="0" max={max} step="1" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}}}/>
    </label>
    <div className="muted mobileBuildHint">Changes save when you leave the quantity field. Maximum: {max}.</div>
  </div>;
}
function MobilePurchasingCard({item,order,updateItem,selected,onSelect,openOrder}:{item:Item,order:Order,updateItem:(item:Item,key:string,value:any)=>Promise<void>,selected:boolean,onSelect:(checked:boolean)=>void,openOrder?:()=>void}){
  const [expanded,setExpanded]=useState(false);
  return <div className="mobileWorkCard">
    <div className="mobileCardHeading"><label className="mobileSelect"><input type="checkbox" checked={selected} onChange={e=>onSelect(e.target.checked)} aria-label={`Select ${item.description}`}/><b>{item.description}</b></label><span className="mobileStatus">{item.purchasing_status}</span></div>
    <div className="muted mobileSubline">{item.sku?'SKU: '+item.sku+' • ':''}{item.vendor||'No vendor'}</div>
    <div className="mobileFacts"><div><small>Sales Order</small>{openOrder?<button type="button" className="mobileTextButton" onClick={openOrder}>{order.order_number}</button>:<strong>{order.order_number}</strong>}</div><div><small>Quantity</small><strong>{item.qty}</strong></div><div><small>Vendor Order #</small><strong>{item.vendor_order_number||'—'}</strong></div><div><small>ETA</small><strong>{item.eta_date||'—'}</strong></div></div>
    <button type="button" className="btn secondary mobileFullButton" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide Purchasing Details':'Edit Purchasing Details'}</button>
    {expanded&&<div className="mobileEditFields">
      <label>Status<select value={item.purchasing_status} onChange={e=>void updateItem(item,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Vendor Order #<input key={`${item.id}-mobile-vendor-${item.vendor_order_number||''}`} defaultValue={item.vendor_order_number||''} onBlur={e=>{const v=e.target.value.trim();if(v!==(item.vendor_order_number||''))void updateItem(item,'vendor_order_number',v||null)}}/></label>
      <label>Expected Arrival<input key={`${item.id}-mobile-eta-${item.eta_date||''}`} type="date" defaultValue={item.eta_date||''} onChange={e=>{if(e.target.value!==(item.eta_date||''))void updateItem(item,'eta_date',e.target.value||null)}}/></label>
      <label>Tracking #<input key={`${item.id}-mobile-track-${item.tracking||''}`} defaultValue={item.tracking||''} onBlur={e=>{const v=e.target.value.trim();if(v!==(item.tracking||''))void updateItem(item,'tracking',v||null)}}/></label>
      <MobilePurchasingNote item={item} updateItem={updateItem}/>
    </div>}
  </div>;
}
function MobilePurchasingNote({item,updateItem}:{item:Item,updateItem:(item:Item,key:string,value:any)=>Promise<void>}){
  const [draft,setDraft]=useState(item.purchasing_notes||'');
  useEffect(()=>setDraft(item.purchasing_notes||''),[item.id,item.purchasing_notes]);
  return <label>Purchasing Notes<textarea rows={3} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==(item.purchasing_notes||''))void updateItem(item,'purchasing_notes',draft||null)}}/></label>;
}
function PurchasingView({orders,updateItem,createPurchaseOrder,openOrder}:any){const [showReceived,setShowReceived]=useState(false),[search,setSearch]=useState(''),[selectedIds,setSelectedIds]=useState<string[]>([]),[page,setPage]=useState(1);const rows=orders.filter((o:any)=>o.status!=='Draft').flatMap((o:any)=>(o.order_items||[]).filter((i:any)=>i.item_type==='Product').map((i:any)=>({item:i,order:o}))).filter((x:any)=>showReceived||x.item.purchasing_status!=='Received').filter((x:any)=>{const q=search.trim().toLowerCase();return !q||[x.order.order_number,x.order.reference_number,x.order.customers?.name,x.item.description,x.item.sku,x.item.vendor,x.item.purchasing_status,x.item.tracking,x.item.vendor_order_number,x.item.purchasing_notes].some((v:any)=>(v||'').toLowerCase().includes(q))});const safePage=Math.min(page,Math.max(1,Math.ceil(rows.length/LIST_PAGE_SIZE)));const pageRows=rows.slice((safePage-1)*LIST_PAGE_SIZE,safePage*LIST_PAGE_SIZE);const counts=['Need to Order','Ordered','Backordered','Shipped','Received'].map(st=>({st,n:orders.filter((o:any)=>o.status!=='Draft').flatMap((o:any)=>o.order_items||[]).filter((i:any)=>i.item_type==='Product'&&i.purchasing_status===st).length}));const chosen=rows.filter((x:any)=>selectedIds.includes(x.item.id));const canPO=chosen.length>0&&chosen.every((x:any)=>x.order.id===chosen[0].order.id&&x.item.vendor===chosen[0].item.vendor)&&!!chosen[0].order.reference_number;function toggle(x:any,checked:boolean){if(checked&&selectedIds.length){const first=rows.find((r:any)=>r.item.id===selectedIds[0]);if(first&&(first.order.id!==x.order.id||first.item.vendor!==x.item.vendor)){alert('Select items from the same Sales Order and vendor for one PO.');return}}setSelectedIds(v=>checked?[...new Set([...v,x.item.id])]:v.filter(id=>id!==x.item.id))}return <><div className="row" style={{justifyContent:'space-between',marginBottom:18}}><div><h1>Parts Purchasing</h1><div className="muted">Company-wide purchasing overview. Open an order to manage purchasing for one customer.</div></div><div className="row"><input placeholder="Search order, customer, part, SKU or vendor" value={search} onChange={e=>setSearch(e.target.value)} style={{width:360}}/><label className="row" style={{gap:7}}><input type="checkbox" checked={showReceived} onChange={e=>setShowReceived(e.target.checked)}/> Show Received</label></div></div><div className="cards">{counts.map(x=><div className="card" key={x.st}><div className="muted">{x.st}</div><div className="value">{x.n}</div></div>)}</div>{selectedIds.length>0&&<div className="panel"><div className="row" style={{justifyContent:'space-between'}}><div><b>{selectedIds.length} item{selectedIds.length===1?'':'s'} selected</b>{chosen[0]&&<div className="muted">{chosen[0].item.vendor} • {chosen[0].order.reference_number||'Reference # required'}</div>}</div><div className="row"><button className="btn secondary" onClick={()=>setSelectedIds([])}>Clear</button><button className="btn" disabled={!canPO} onClick={async()=>{await createPurchaseOrder(chosen[0].order,chosen.map((x:any)=>x.item));setSelectedIds([])}}>Create PO</button></div></div></div>}<div className="mobileCards">{rows.length===0&&<div className="muted">No purchasing items match this view.</div>}{pageRows.map(({item:i,order:o}:any)=><MobilePurchasingCard key={i.id} item={i} order={o} updateItem={updateItem} selected={selectedIds.includes(i.id)} onSelect={checked=>toggle({item:i,order:o},checked)} openOrder={()=>openOrder(o)}/>)}</div><div className="panel desktopWorkTable"><table><thead><tr><th></th><th>Order / Customer</th><th>Part</th><th>Vendor</th><th>Qty</th><th>Status</th><th>Vendor Order #</th><th>ETA (Expected Arrival)</th><th>Tracking #</th><th>Notes</th></tr></thead><tbody>{pageRows.map(({item:i,order:o}:any)=><tr key={i.id}><td><input type="checkbox" checked={selectedIds.includes(i.id)} onChange={e=>toggle({item:i,order:o},e.target.checked)}/></td><td><button className="btn ghost" onClick={()=>openOrder(o)}>{o.order_number}</button>{o.reference_number&&<div><b>{o.reference_number}</b></div>}<div className="muted">{o.customers?.name||'—'}</div></td><td><b>{i.description}</b>{i.sku&&<div className="muted">SKU: {i.sku}</div>}</td><td>{i.vendor||'—'}</td><td>{Number(i.qty)}</td><td><select value={i.purchasing_status} onChange={e=>updateItem(i,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select></td><PurchasingFields item={i} updateItem={updateItem}/></tr>)}{rows.length===0&&<tr><td colSpan={10} className="muted">No purchasing items match this view.</td></tr>}</tbody></table></div><ListPagination page={safePage} onPageChange={setPage} total={rows.length}/></>}

function PurchaseOrdersView({purchaseOrders,openPO}:any){const [page,setPage]=useState(1);const safePage=Math.min(page,Math.max(1,Math.ceil(purchaseOrders.length/LIST_PAGE_SIZE)));return <><div style={{marginBottom:18}}><h1>Purchase Orders</h1><div className="muted">Vendor POs created from Parts Purchasing.</div></div><div className="panel"><table><thead><tr><th>PO Number</th><th>Vendor</th><th>Sales Order</th><th>Customer</th><th>Date</th><th>Total Cost</th><th>Status</th></tr></thead><tbody>{purchaseOrders.slice((safePage-1)*LIST_PAGE_SIZE,safePage*LIST_PAGE_SIZE).map((po:any)=>{const total=(po.purchase_order_items||[]).reduce((a:number,i:any)=>a+Number(i.qty)*Number(i.unit_cost||0),0);return <tr key={po.id} onClick={()=>openPO(po)} style={{cursor:'pointer'}}><td><b>{po.po_number}</b></td><td>{po.vendor}</td><td>{po.orders?.order_number||'—'}</td><td>{po.orders?.customers?.name||'—'}</td><td>{new Date(po.created_at).toLocaleDateString()}</td><td>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{po.status}</td></tr>})}{purchaseOrders.length===0&&<tr><td colSpan={7} className="muted">No purchase orders yet.</td></tr>}</tbody></table></div><ListPagination page={safePage} onPageChange={setPage} total={purchaseOrders.length}/></>}

function PurchaseOrderView({po,back}:any){const items=po.purchase_order_items||[],total=items.reduce((a:number,i:any)=>a+Number(i.qty)*Number(i.unit_cost||0),0);return <><div className="invoice-actions row"><button className="btn ghost" onClick={back}>← Back to Purchase Orders</button><button className="btn secondary" onClick={()=>window.print()}>Print / Save PDF</button></div><div className="invoice-sheet"><div className="invoice-head"><div><img src="/flatout-logo.svg"/><div style={{marginTop:10,lineHeight:1.45}}><b>Flatout Sim Racing</b><div>1388 S 300 W</div><div>Suite 100</div><div>Salt Lake City, UT 84115</div><div>info@driveflatout.com</div></div></div><div className="invoice-title"><h1>PURCHASE ORDER</h1><div><b>PO: {po.po_number}</b></div><div>Vendor: {po.vendor}</div><div className="muted">Date: {new Date(po.created_at).toLocaleDateString()}</div></div></div><div className="invoice-meta"><div><div className="invoice-label">VENDOR</div><b>{po.vendor}</b></div><div><div className="invoice-label">SALES ORDER</div><div>{po.orders?.order_number||'—'}</div><div>{po.orders?.customers?.name||''}</div></div><div><div className="invoice-label">SHIP TO</div><b>Flatout Sim Racing</b><div>1388 S 300 W, Suite 100</div><div>Salt Lake City, UT 84115</div></div></div><table className="invoice-table"><thead><tr><th>Description</th><th>SKU</th><th>Qty</th><th>Unit Cost</th><th>Amount</th></tr></thead><tbody>{items.map((i:any)=><tr key={i.id}><td><b>{i.description}</b></td><td>{i.sku||'—'}</td><td>{Number(i.qty)}</td><td>${Number(i.unit_cost||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${(Number(i.qty)*Number(i.unit_cost||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table><div className="invoice-summary"><div className="invoice-total"><span>PO Total</span><b>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div></div>{po.notes&&<div className="panel"><b>Notes</b><div style={{whiteSpace:'pre-line',marginTop:6}}>{po.notes}</div></div>}<div className="invoice-footer">Flatout Sim Racing Purchase Order</div></div></>}

function OrderView({o,products,totals,addProduct,addOther,openInvoice,openQuote,dup,del,updateItem,updateOrderDetails,updateOrderStatus,createPurchaseOrder,purchaseOrders,openPO,addOrderNote,createBuild,builds,openBuild}:any){const [section,setSection]=useState('Order Items'),[pid,setPid]=useState(''),[productSearch,setProductSearch]=useState(''),[shipping,setShipping]=useState(o.shipping_address||''),
[reference,setReference]=useState(o.reference_number||''),
[taxRate,setTaxRate]=useState(Number(o.tax_rate||0)),
[shippingAmount,setShippingAmount]=useState(Number(o.shipping_amount||0)),
[taxExempt,setTaxExempt]=useState(Boolean(o.tax_exempt)),
[orderDate,setOrderDate]=useState(String(o.order_date||o.created_at?.slice(0,10)||'').slice(0,10)),
[editingOrderDetails,setEditingOrderDetails]=useState(false),
[selectedIds,setSelectedIds]=useState<string[]>([]),
[note,setNote]=useState('');

useEffect(()=>{
  setShipping(o.shipping_address||'');
  setReference(o.reference_number||'');
  setTaxRate(Number(o.tax_rate||0));
  setShippingAmount(Number(o.shipping_amount||0));
  setTaxExempt(Boolean(o.tax_exempt));
  setOrderDate(String(o.order_date||o.created_at?.slice(0,10)||'').slice(0,10));
  setSelectedIds([]);
},[
  o.id,
  o.shipping_address,
  o.reference_number,
  o.tax_rate,
  o.shipping_amount,
  o.tax_exempt,
  o.order_date
]);
const q=productSearch.trim().toLowerCase(),matches=q?products.filter((p:any)=>[p.name,p.sku,p.vendor,p.category].some((v:any)=>(v||'').toLowerCase().includes(q))).slice(0,12):[];const physical=(o.order_items||[]).filter((i:any)=>i.item_type==='Product');const chosen=physical.filter((i:any)=>selectedIds.includes(i.id));const canPO=chosen.length>0&&chosen.every((i:any)=>i.vendor===chosen[0].vendor)&&!!chosen[0].vendor&&!!o.reference_number;const orderPOs=(purchaseOrders||[]).filter((po:any)=>po.order_id===o.id);const orderBuilds=(builds||[]).filter((b:Build)=>b.order_id===o.id);const statuses=['Draft','Confirmed','Parts Ordering','Parts Ordered','Build Ready','Building','Ready for Installation','Completed'];function togglePOItem(i:any,checked:boolean){if(checked&&selectedIds.length){const first=physical.find((x:any)=>x.id===selectedIds[0]);if(first&&first.vendor!==i.vendor){alert('Select items from the same vendor for one PO.');return}}setSelectedIds(v=>checked?[...new Set([...v,i.id])]:v.filter(id=>id!==i.id))}return <><div className="row mobileOrderHeader" style={{justifyContent:'space-between',alignItems:'flex-start'}}><div><h1>{o.order_number}</h1><div className="muted">{o.customers?.name}{o.reference_number?` • ${o.reference_number}`:''}</div></div><div className="row mobileOrderActions"><div className="field" style={{margin:0,minWidth:210}}><label>Order Status</label><select value={o.status} onChange={e=>updateOrderStatus(e.target.value)}>{statuses.map(x=><option key={x}>{x}</option>)}</select></div>{o.status!=='Draft'&&<button className="btn" onClick={()=>createBuild(o)}>+ Create Build</button>}{o.status==='Draft'&&<button className="btn secondary" onClick={openQuote}>View / Print Quote</button>}{o.status!=='Draft'&&<button className="btn secondary" onClick={openInvoice}>View Invoice</button>}</div></div><div className="panel" style={{marginTop:18}}>
  <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
    <h2 style={{margin:0}}>Order Details</h2>

    {!editingOrderDetails ? (
      <button
        className="btn secondary"
        onClick={()=>setEditingOrderDetails(true)}
      >
        Edit
      </button>
    ) : (
      <div className="row">
        <button
          className="btn ghost"
          onClick={()=>{
            setReference(o.reference_number||'');
            setShipping(o.shipping_address||'');
            setTaxRate(Number(o.tax_rate||0));
            setShippingAmount(Number(o.shipping_amount||0));
            setTaxExempt(Boolean(o.tax_exempt));
            setOrderDate(String(o.order_date||o.created_at?.slice(0,10)||'').slice(0,10));
            setEditingOrderDetails(false);
          }}
        >
          Cancel
        </button>

        <button
          className="btn"
          onClick={async()=>{
            const saved=await updateOrderDetails(
              reference,
              shipping,
              taxRate,
              shippingAmount,
              taxExempt,
              orderDate
            );
            if(saved)setEditingOrderDetails(false);
          }}
        >
          Save Changes
        </button>
      </div>
    )}
  </div>

<div className="grid">
    <div className="field" style={{margin:0}}>
      <label>Order Date</label>
      {editingOrderDetails ? (
        <input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} required/>
      ) : (
        <div>{o.order_date||o.created_at?.slice(0,10)||'—'}</div>
      )}
    </div>
    <div className="field" style={{margin:0}}>
      <label>Reference #</label>
      {editingOrderDetails ? (
        <input
          value={reference}
          onChange={e=>setReference(e.target.value)}
          placeholder="e.g. PO Mansell"
        />
      ) : (
        <div>{o.reference_number||'—'}</div>
      )}
    </div>

    <div className="field" style={{margin:0}}>
      <label>Shipping Address</label>
      {editingOrderDetails ? (
        <textarea
          value={shipping}
          onChange={e=>setShipping(e.target.value)}
          placeholder="Shipping address for this order"
          rows={2}
          style={{width:'100%',resize:'vertical'}}
        />
      ) : (
        <div style={{whiteSpace:'pre-line'}}>
          {o.shipping_address||'—'}
        </div>
      )}
    </div>
  
    <div className="field" style={{margin:0}}>
      <label>Tax Rate (%)</label>
      {editingOrderDetails ? (
        <input
          type="number"
          step="0.01"
          value={taxRate}
          onChange={e=>setTaxRate(Number(e.target.value))}
        />
      ) : (
        <div>{Number(o.tax_rate||0).toFixed(2)}%</div>
      )}
    </div>

    <div className="field" style={{margin:0}}>
      <label>Shipping ($)</label>
      {editingOrderDetails ? (
        <input
          type="number"
          step="0.01"
          value={shippingAmount}
          onChange={e=>setShippingAmount(Number(e.target.value))}
        />
      ) : (
        <div>
          ${Number(o.shipping_amount||0).toLocaleString(undefined,{
            minimumFractionDigits:2,
            maximumFractionDigits:2
          })}
        </div>
      )}
    </div>

    <div className="field" style={{margin:0}}>
      <label>Tax Exempt</label>
      {editingOrderDetails ? (
        <input
          type="checkbox"
          checked={taxExempt}
          onChange={e=>setTaxExempt(e.target.checked)}
        />
      ) : (
        <div>{o.tax_exempt?'Yes':'No'}</div>
      )}
    </div>
  </div>
</div>
  <div className="cards" style={{marginTop:18}}><div className="card"><div className="muted">Sell</div><div className="value">{fmtMoney(totals.sell)}</div></div><div className="card"><div className="muted">Cost</div><div className="value">{fmtMoney(totals.cost)}</div></div><div className="card"><div className="muted">Gross Profit</div><div className="value">{fmtMoney(totals.gp)}</div></div><div className="card"><div className="muted">Gross Margin</div><div className="value">{totals.gm.toFixed(1)}%</div></div></div><div className="row mobileSectionTabs" style={{gap:8,margin:'18px 0'}}>{(o.status==='Draft'?['Order Items']:['Order Items','Purchasing','Purchase Orders','Builds','Payments']).map(x=><button key={x} className={section===x?'btn secondary fx-selected':'btn secondary'} onClick={()=>setSection(x)}>{x}{x==='Purchase Orders'&&orderPOs.length?` (${orderPOs.length})`:x==='Builds'?` (${orderBuilds.length})`:''}</button>)}</div>{section==='Order Items'&&<><div className="row mobileItemToolbar" style={{justifyContent:'space-between',marginBottom:12}}><h2 style={{margin:0}}>Order Items</h2><div className="row"><div style={{position:'relative',minWidth:330}}><input value={productSearch} onChange={e=>{setProductSearch(e.target.value);setPid('')}} placeholder="Search product, SKU, vendor or category..." style={{width:'100%'}}/>{q&&matches.length>0&&!pid&&<div style={{position:'absolute',zIndex:20,top:'100%',left:0,right:0,background:'#fff',border:'1px solid #dce0d9',maxHeight:300,overflowY:'auto',boxShadow:'0 8px 20px rgba(0,0,0,.12)'}}>{matches.map((p:any)=><button type="button" key={p.id} onClick={()=>{setPid(p.id);setProductSearch(p.name)}} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 12px',background:'#fff',border:0,borderBottom:'1px solid #eee',cursor:'pointer'}}><b>{p.name}</b><div className="muted">{[p.sku,p.vendor,p.category].filter(Boolean).join(' • ')}</div></button>)}</div>}</div><button className="btn" disabled={!pid} onClick={()=>{if(pid){addProduct(pid);setPid('');setProductSearch('')}}}>+ Add Product</button><button className="btn secondary" onClick={addOther}>+ Labor / Other</button></div></div><div className="panel"><table><thead><tr><th>Item</th><th>Type</th><th className="fx-num">Qty</th><th className="fx-num">Sell</th><th className="fx-num">Cost</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(o.order_items||[]).map((i:any)=><tr key={i.id}><td><b>{i.description}</b><div className="muted">{i.vendor}</div></td><td>{i.item_type}</td><td className="fx-num"><input style={{width:60,textAlign:'right'}} defaultValue={i.qty} onBlur={e=>updateItem(i,'qty',Number(e.target.value))}/></td><td className="fx-num"><input style={{width:100,textAlign:'right'}} defaultValue={i.sell_price} onBlur={e=>updateItem(i,'sell_price',Number(e.target.value))}/></td><td className="fx-num"><input style={{width:100,textAlign:'right'}} defaultValue={i.cost??''} placeholder="—" onBlur={e=>updateItem(i,'cost',e.target.value===''?null:Number(e.target.value))}/></td><td>{i.item_type==='Product'?<select className={`fx-sel fx-sel-${statusTone(i.purchasing_status)}`} value={i.purchasing_status} onChange={e=>updateItem(i,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select>:'—'}</td><td><div className="row"><button className="btn ghost" onClick={()=>dup(i)}>Duplicate</button><button className="btn ghost" onClick={()=>del(i)}>Remove</button></div></td></tr>)}</tbody></table></div></>}{section==='Purchasing'&&<><div className="row" style={{justifyContent:'space-between',marginBottom:12}}><div><h2 style={{margin:0}}>Purchasing</h2><div className="muted">Manage parts for this Sales Order and create vendor POs here.</div></div>{selectedIds.length>0&&<div className="row"><span className="muted">{chosen.length} selected • {chosen[0]?.vendor||'Vendor required'}</span><button className="btn secondary" onClick={()=>setSelectedIds([])}>Clear</button><button className="btn" disabled={!canPO} onClick={async()=>{await createPurchaseOrder(o,chosen);setSelectedIds([])}}>Create PO</button></div>}</div>{!o.reference_number&&<div className="panel"><b>Reference # required for Purchase Orders.</b><div className="muted">Add a Reference # above before creating a vendor PO.</div></div>}<div className="mobileCards">{physical.length===0&&<div className="muted">No physical products on this order.</div>}{physical.map((i:any)=><MobilePurchasingCard key={i.id} item={i} order={o} updateItem={updateItem} selected={selectedIds.includes(i.id)} onSelect={checked=>togglePOItem(i,checked)}/>)}</div><div className="panel desktopWorkTable"><table><thead><tr><th></th><th>Part</th><th>SKU</th><th>Vendor</th><th>Qty</th><th>Status</th><th>Vendor Order #</th><th>ETA (Expected Arrival)</th><th>Tracking #</th><th>Notes</th></tr></thead><tbody>{physical.map((i:any)=><tr key={i.id}><td><input type="checkbox" checked={selectedIds.includes(i.id)} onChange={e=>togglePOItem(i,e.target.checked)}/></td><td><b>{i.description}</b></td><td>{i.sku||'—'}</td><td>{i.vendor||'—'}</td><td>{Number(i.qty)}</td><td><select value={i.purchasing_status} onChange={e=>updateItem(i,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select></td><PurchasingFields item={i} updateItem={updateItem}/></tr>)}{physical.length===0&&<tr><td colSpan={10} className="muted">No physical products on this order.</td></tr>}</tbody></table></div></>}{section==='Purchase Orders'&&<div className="panel"><h2>Purchase Orders</h2><table><thead><tr><th>PO Number</th><th>Vendor</th><th>Date</th><th>Total Cost</th><th>Status</th></tr></thead><tbody>{orderPOs.map((po:any)=>{const total=(po.purchase_order_items||[]).reduce((a:number,i:any)=>a+Number(i.qty)*Number(i.unit_cost||0),0);return <tr key={po.id} onClick={()=>openPO(po)} style={{cursor:'pointer'}}><td><b>{po.po_number}</b></td><td>{po.vendor}</td><td>{new Date(po.created_at).toLocaleDateString()}</td><td>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{po.status}</td></tr>})}{orderPOs.length===0&&<tr><td colSpan={5} className="muted">No Purchase Orders have been created for this Sales Order yet.</td></tr>}</tbody></table></div>}{section==='Builds'&&<div className="panel"><h2>Builds for {o.order_number}</h2><div style={{padding:16,display:'grid',gap:12}}>{orderBuilds.length===0&&<div className="muted">No builds have been created for this Sales Order yet. Use + Create Build above to get started.</div>}{orderBuilds.map((b:Build)=><div key={b.id} style={{border:'1px solid var(--platinum)',borderRadius:8,padding:14,display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}}><div style={{minWidth:0}}><b>{b.build_number}</b><div>{b.name||'Simulator Build'}</div><div className="muted" style={{fontSize:13}}>Status: {b.canceled_at?'Canceled':b.status}{b.installation_date?` • Installation: ${displayBuildDate(b.installation_date)}`:''}</div></div><button type="button" className="btn" onClick={()=>openBuild(b)}>Open Build</button></div>)}</div></div>}{section==='Payments'&&<div className="panel"><div className="row" style={{justifyContent:'space-between'}}><div><h2>Payments</h2><div className="muted">Payment status: {o.payment_status}</div></div><button className="btn" onClick={openInvoice}>Open Invoice / Record Payment</button></div><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th>Amount</th></tr></thead><tbody>{(o.payments||[]).map((p:any)=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleDateString()}</td><td>{p.payment_method||'—'}</td><td>{p.reference||'—'}</td><td>{p.notes||'—'}</td><td>${Number(p.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}{!(o.payments||[]).length&&<tr><td colSpan={5} className="muted">No payments recorded yet.</td></tr>}</tbody></table></div>}<div className="panel" style={{marginTop:18}}><h2>Order Notes</h2><div style={{maxHeight:320,overflowY:'auto',marginBottom:18}}>{[...(o.order_notes||[])].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).map((n:any)=><div key={n.id} style={{padding:'12px 0',borderBottom:'1px solid #eee'}}><div style={{whiteSpace:'pre-line'}}>{n.note}</div><div className="muted" style={{marginTop:5}}>{new Date(n.created_at).toLocaleString()}</div></div>)}{!(o.order_notes||[]).length&&<div className="muted">No order notes yet.</div>}</div><div className="field"><label>Add Order Note</label><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Backorder, ETA, vendor update, customer update, installation note, etc."/></div><button className="btn" disabled={!note.trim()} onClick={async()=>{await addOrderNote(note);setNote('')}}>Add Note</button></div>
</>  
  }
function InvoiceView({o,totals,back,addPayment,adjustPayment,quote=false}:any){
const [summaryPrint,setSummaryPrint]=useState(false);
useEffect(()=>{const reset=()=>setSummaryPrint(false);window.addEventListener('afterprint',reset);return ()=>window.removeEventListener('afterprint',reset)},[]);
function printSummary(){setSummaryPrint(true);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));}
const tax=o.tax_exempt?0:totals.sell*Number(o.tax_rate||0)/100,total=totals.sell+tax+Number(o.shipping_amount||0),paid=(o.payments||[]).reduce((a:number,p:any)=>a+Number(p.amount),0)-(o.payment_adjustments||[]).reduce((a:number,x:any)=>a+Number(x.amount),0),balance=Math.max(0,total-paid);return <><style>{`
@media print {
  @page { size: letter; margin: 0.42in 0.48in; }
  body { background: white !important; color: #111 !important; }
  body * { visibility: hidden !important; }
  .invoice-sheet, .invoice-sheet * { visibility: visible !important; }
  .invoice-sheet {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: 100% !important; max-width: none !important; min-height: 0 !important;
    margin: 0 !important; padding: 0 !important; border: 0 !important;
    box-shadow: none !important; background: white !important; color: #111 !important;
    font-size: 9pt !important; line-height: 1.2 !important;
  }
  .invoice-sheet .invoice-head { margin: 0 0 10px !important; padding: 0 0 10px !important; gap: 14px !important; }
  .invoice-sheet .invoice-head img { max-height: 44px !important; max-width: 180px !important; width: auto !important; }
  .invoice-sheet .invoice-head > div > div { margin-top: 4px !important; line-height: 1.22 !important; }
  .invoice-sheet .invoice-title h1 { font-size: 19pt !important; line-height: 1.1 !important; margin: 0 0 3px !important; }
  .invoice-sheet .invoice-title { font-size: 9pt !important; }
  .invoice-sheet .invoice-meta { margin: 8px 0 10px !important; padding: 8px 0 !important; gap: 10px !important; line-height: 1.22 !important; }
  .invoice-sheet .invoice-label { font-size: 8pt !important; margin-bottom: 3px !important; }
  .invoice-sheet .invoice-table { width: 100% !important; font-size: 8.5pt !important; line-height: 1.15 !important; border-collapse: collapse !important; margin: 0 !important; }
  .invoice-sheet .invoice-table th { padding: 5px 7px !important; font-size: 8pt !important; }
  .invoice-sheet .invoice-table td { padding: 5px 7px !important; vertical-align: top !important; }
  .invoice-sheet .invoice-table td .muted { font-size: 7.5pt !important; line-height: 1.1 !important; margin: 1px 0 0 !important; }
  .invoice-sheet .invoice-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  .invoice-sheet .invoice-table thead { display: table-header-group !important; }
  .invoice-sheet .invoice-summary { margin: 10px 0 !important; padding: 0 !important; font-size: 9pt !important; }
  .invoice-sheet .invoice-summary > div { padding: 4px 6px !important; min-height: 0 !important; }
  /* The transaction ledger stays available in the ERP, but is never customer-facing. */
  .invoice-sheet .payment-history { display: none !important; }
  .invoice-sheet .payment-history { margin-top: 12px !important; }
  .invoice-sheet .payment-history h2 { font-size: 12pt !important; margin: 0 0 6px !important; }
  .invoice-sheet .payment-history h3 { font-size: 10pt !important; margin: 8px 0 5px !important; }
  .invoice-sheet .payment-history table { width: 100% !important; font-size: 8pt !important; border-collapse: collapse !important; }
  .invoice-sheet .payment-history th, .invoice-sheet .payment-history td { padding: 5px 6px !important; }
  .invoice-sheet .payment-history table:first-of-type th:last-child,
  .invoice-sheet .payment-history table:first-of-type td:last-child { display: none !important; }
  .invoice-sheet .invoice-footer { margin: 10px 0 0 !important; padding: 7px 0 0 !important; font-size: 8pt !important; break-inside: avoid !important; }
}
`}</style><div className="invoice-actions row"><button className="btn ghost" onClick={back}>{quote?'← Back to Quotation':'← Back to Order'}</button><button className="btn secondary" onClick={()=>{setSummaryPrint(false);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));}}>Print / Save PDF</button><button className="btn secondary" onClick={printSummary}>{quote?'Print Summary Quote':'Print Summary Invoice'}</button>{!quote&&<button className="btn" onClick={addPayment}>+ Record Payment</button>}</div><div className="invoice-sheet"><div className="invoice-head"><div><img src="/flatout-logo.svg"/><div style={{marginTop:10,lineHeight:1.45}}><b>Flatout Sim Racing</b><div>1388 S 300 W</div><div>Suite 100</div><div>Salt Lake City, UT 84115</div><div>info@driveflatout.com</div></div></div><div className="invoice-title"><h1>{quote?'QUOTATION':'INVOICE'}</h1><div><b>{o.order_number}</b></div>{o.reference_number&&<div>Reference: {o.reference_number}</div>}{!quote&&<div className="muted">Status: {o.payment_status}</div>}</div></div><div className="invoice-meta"><div><div className="invoice-label">BILL TO</div><b>{o.customers?.name}</b>{o.customers?.company&&<div>{o.customers.company}</div>}{o.customers?.email&&<div>{o.customers.email}</div>}{o.customers?.phone&&<div>{o.customers.phone}</div>}{o.customers?.billing_address&&<div>{o.customers.billing_address}</div>}</div>{o.shipping_address&&<div><div className="invoice-label">SHIP TO</div><div style={{whiteSpace:'pre-line'}}>{o.shipping_address}</div></div>}<div><div className="invoice-label">{quote?'QUOTE DATE':'INVOICE DATE'}</div><div>{String(o.order_date||o.created_at?.slice(0,10)||'—')}</div></div></div><table className="invoice-table" style={summaryPrint?{display:"none"}:undefined}><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>{(o.order_items||[]).map((i:any)=><tr key={i.id}><td><b>{i.description}</b>{i.sku&&<div className="muted">SKU: {i.sku}</div>}</td><td>{Number(i.qty)}</td><td>${Number(i.sell_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>${(Number(i.qty)*Number(i.sell_price)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table>{summaryPrint&&<table className="invoice-table"><thead><tr><th>Description</th><th>Qty</th></tr></thead><tbody>{(o.order_items||[]).map((i:any)=><tr key={i.id}><td><b>{i.description}</b>{i.sku&&<div className="muted">SKU: {i.sku}</div>}</td><td>{Number(i.qty)}</td></tr>)}</tbody></table>}<div className="invoice-summary"><div><span>Subtotal</span><b>${totals.sell.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div><div><span>Tax ({Number(o.tax_rate||0).toFixed(2)}%)</span><b>${tax.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>{Number(o.shipping_amount||0)>0&&<div><span>Shipping</span><b>${Number(o.shipping_amount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>}<div className="invoice-total"><span>{quote?'Estimated Total':'Total'}</span><b>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>{!quote&&<><div><span>Payments Applied</span><b>${paid.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div><div className="invoice-balance"><span>Balance Due</span><b>${balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div></>}</div>{(o.payments||[]).length>0&&!quote&&<div className="payment-history"><h2>Payments</h2><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th><th>Action</th></tr></thead><tbody>{o.payments.map((p:any)=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleDateString()}</td><td>{p.payment_method||'—'}</td><td>{p.reference||'—'}</td><td>${Number(p.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td><button type="button" className="btn secondary" onClick={()=>adjustPayment(p)}>Refund / Void</button></td></tr>)}</tbody></table>{(o.payment_adjustments||[]).length>0&&<><h3>Refunds and Voids (ERP records only)</h3><table><thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Square Reference</th><th>Amount</th></tr></thead><tbody>{(o.payment_adjustments||[]).map((a:any)=><tr key={a.id}><td>{new Date(a.created_at).toLocaleDateString()}</td><td>{a.adjustment_type}</td><td>{a.reason}</td><td>{a.square_reference||'—'}</td><td>-${Number(a.amount).toFixed(2)}</td></tr>)}</tbody></table></>}</div>}{quote&&<div className="muted" style={{marginTop:18}}>This quotation is an estimate and is not an invoice or request for payment. Pricing and availability are subject to confirmation.</div>}<div className="invoice-footer">Thank you for choosing Flatout Sim Racing.</div></div></>}

function PaymentAdjustmentForm({payment,adjustments,submit}:any){
 const remaining=Math.max(0,Math.round((Number(payment.amount)-(adjustments||[]).reduce((v:number,a:any)=>v+Number(a.amount),0))*100)/100);
 const [kind,setKind]=useState('Refund');
 return <form action={submit}><h2>Record Refund / Void</h2><p className="muted">Record only after completing the action in Square. This form does not process money.</p><p>Original payment: ${Number(payment.amount).toFixed(2)} | Remaining: ${remaining.toFixed(2)}</p><div className="field"><label>Type</label><select name="adjustment_type" value={kind} onChange={e=>setKind(e.target.value)}><option>Refund</option><option disabled={remaining!==Number(payment.amount)}>Void</option></select></div><div className="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" max={remaining} defaultValue={remaining.toFixed(2)} disabled={kind==='Void'} required/></div><div className="field"><label>Reason</label><input name="reason" required placeholder="Why was this refunded or voided?"/></div><div className="field"><label>Square transaction / refund reference (optional)</label><input name="square_reference"/></div><button className="btn" disabled={remaining<=0}>Record {kind} in ERP</button></form>
}
