
    
  
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
  <div className="cards" style={{marginTop:18}}><div className="card"><div className="muted">Sell</div><div className="value">${totals.sell.toLocaleString()}</div></div><div className="card"><div className="muted">Cost</div><div className="value">${totals.cost.toLocaleString()}</div></div><div className="card"><div className="muted">Gross Profit</div><div className="value">${totals.gp.toLocaleString()}</div></div><div className="card"><div className="muted">Gross Margin</div><div className="value">{totals.gm.toFixed(1)}%</div></div></div><div className="row" style={{gap:8,margin:'18px 0'}}>{(o.status==='Draft'?['Order Items']:['Order Items','Purchasing','Purchase Orders','Payments']).map(x=><button key={x} className={section===x?'btn':'btn secondary'} onClick={()=>setSection(x)}>{x}{x==='Purchase Orders'&&orderPOs.length?` (${orderPOs.length})`:''}</button>)}</div>{section==='Order Items'&&<><div className="row" style={{justifyContent:'space-between',marginBottom:12}}><h2 style={{margin:0}}>Order Items</h2><div className="row"><div style={{position:'relative',minWidth:330}}><input value={productSearch} onChange={e=>{setProductSearch(e.target.value);setPid('')}} placeholder="Search product, SKU, vendor or category..." style={{width:'100%'}}/>{q&&matches.length>0&&!pid&&<div style={{position:'absolute',zIndex:20,top:'100%',left:0,right:0,background:'#fff',border:'1px solid #dce0d9',maxHeight:300,overflowY:'auto',boxShadow:'0 8px 20px rgba(0,0,0,.12)'}}>{matches.map((p:any)=><button type="button" key={p.id} onClick={()=>{setPid(p.id);setProductSearch(p.name)}} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 12px',background:'#fff',border:0,borderBottom:'1px solid #eee',cursor:'pointer'}}><b>{p.name}</b><div className="muted">{[p.sku,p.vendor,p.category].filter(Boolean).join(' • ')}</div></button>)}</div>}</div><button className="btn" disabled={!pid} onClick={()=>{if(pid){addProduct(pid);setPid('');setProductSearch('')}}}>+ Add Product</button><button className="btn secondary" onClick={addOther}>+ Labor / Other</button></div></div><div className="panel"><table><thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Sell</th><th>Cost</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(o.order_items||[]).map((i:any)=><tr key={i.id}><td><b>{i.description}</b><div className="muted">{i.vendor}</div></td><td>{i.item_type}</td><td><input style={{width:60}} defaultValue={i.qty} onBlur={e=>updateItem(i,'qty',Number(e.target.value))}/></td><td><input style={{width:100}} defaultValue={i.sell_price} onBlur={e=>updateItem(i,'sell_price',Number(e.target.value))}/></td><td><input style={{width:100}} defaultValue={i.cost??''} placeholder="—" onBlur={e=>updateItem(i,'cost',e.target.value===''?null:Number(e.target.value))}/></td><td>{i.item_type==='Product'?<select value={i.purchasing_status} onChange={e=>updateItem(i,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select>:'—'}</td><td><div className="row"><button className="btn ghost" onClick={()=>dup(i)}>Duplicate</button><button className="btn ghost" onClick={()=>del(i)}>Remove</button></div></td></tr>)}</tbody></table></div></>}{section==='Purchasing'&&<><div className="row" style={{justifyContent:'space-between',marginBottom:12}}><div><h2 style={{margin:0}}>Purchasing</h2><div className="muted">Manage parts for this Sales Order and create vendor POs here.</div></div>{selectedIds.length>0&&<div className="row"><span className="muted">{chosen.length} selected • {chosen[0]?.vendor||'Vendor required'}</span><button className="btn secondary" onClick={()=>setSelectedIds([])}>Clear</button><button className="btn" disabled={!canPO} onClick={async()=>{await createPurchaseOrder(o,chosen);setSelectedIds([])}}>Create PO</button></div>}</div>{!o.reference_number&&<div className="panel"><b>Reference # required for Purchase Orders.</b><div className="muted">Add a Reference # above before creating a vendor PO.</div></div>}<div className="panel"><table><thead><tr><th></th><th>Part</th><th>SKU</th><th>Vendor</th><th>Qty</th><th>Status</th><th>Tracking</th></tr></thead><tbody>{physical.map((i:any)=><tr key={i.id}><td><input type="checkbox" checked={selectedIds.includes(i.id)} onChange={e=>togglePOItem(i,e.target.checked)}/></td><td><b>{i.description}</b></td><td>{i.sku||'—'}</td><td>{i.vendor||'—'}</td><td>{Number(i.qty)}</td><td><select value={i.purchasing_status} onChange={e=>updateItem(i,'purchasing_status',e.target.value)}>{['Need to Order','Ordered','Backordered','Shipped','Received'].map(x=><option key={x}>{x}</option>)}</select></td><td><input key={`${i.id}-${i.tracking||''}`} defaultValue={i.tracking||''} placeholder="Tracking #" onBlur={e=>{if(e.target.value!==(i.tracking||''))updateItem(i,'tracking',e.target.value||null)}} style={{minWidth:170}}/></td></tr>)}{physical.length===0&&<tr><td colSpan={7} className="muted">No physical products on this order.</td></tr>}</tbody></table></div></>}{section==='Purchase Orders'&&<div className="panel"><h2>Purchase Orders</h2><table><thead><tr><th>PO Number</th><th>Vendor</th><th>Date</th><th>Total Cost</th><th>Status</th></tr></thead><tbody>{orderPOs.map((po:any)=>{const total=(po.purchase_order_items||[]).reduce((a:number,i:any)=>a+Number(i.qty)*Number(i.unit_cost||0),0);return <tr key={po.id} onClick={()=>openPO(po)} style={{cursor:'pointer'}}><td><b>{po.po_number}</b></td><td>{po.vendor}</td><td>{new Date(po.created_at).toLocaleDateString()}</td><td>${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{po.status}</td></tr>})}{orderPOs.length===0&&<tr><td colSpan={5} className="muted">No Purchase Orders have been created for this Sales Order yet.</td></tr>}</tbody></table></div>}{section==='Payments'&&<div className="panel"><div className="row" style={{justifyContent:'space-between'}}><div><h2>Payments</h2><div className="muted">Payment status: {o.payment_status}</div></div><button className="btn" onClick={openInvoice}>Open Invoice / Record Payment</button></div><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th>Amount</th></tr></thead><tbody>{(o.payments||[]).map((p:any)=><tr key={p.id}><td>{new Date(p.paid_at).toLocaleDateString()}</td><td>{p.payment_method||'—'}</td><td>{p.reference||'—'}</td><td>{p.notes||'—'}</td><td>${Number(p.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}{!(o.payments||[]).length&&<tr><td colSpan={5} className="muted">No payments recorded yet.</td></tr>}</tbody></table></div>}<div className="panel" style={{marginTop:18}}><h2>Order Notes</h2><div style={{maxHeight:320,overflowY:'auto',marginBottom:18}}>{[...(o.order_notes||[])].sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).map((n:any)=><div key={n.id} style={{padding:'12px 0',borderBottom:'1px solid #eee'}}><div style={{whiteSpace:'pre-line'}}>{n.note}</div><div className="muted" style={{marginTop:5}}>{new Date(n.created_at).toLocaleString()}</div></div>)}{!(o.order_notes||[]).length&&<div className="muted">No order notes yet.</div>}</div><div className="field"><label>Add Order Note</label><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Backorder, ETA, vendor update, customer update, installation note, etc."/></div><button className="btn" disabled={!note.trim()} onClick={async()=>{await addOrderNote(note);setNote('')}}>Add Note</button></div>
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
