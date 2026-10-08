'use client';import {useEffect,useMemo,useState} from 'react';import {supabase} from '@/lib/supabase-browser';import {useRouter} from 'next/navigation';
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
  customers?:Customer,
  order_items?:Item[],
  payments?:Payment[],
   payment_adjustments?:PaymentAdjustment[],
  order_notes?:OrderNote[]
};
type PurchaseOrderItem={id:string,purchase_order_id:string,order_item_id:string|null,description:string,sku:string|null,qty:number,unit_cost:number|null,sort_order:number};type PurchaseOrder={id:string,po_number:string,order_id:string,vendor:string,notes:string|null,status:string,created_at:string,purchase_order_items?:PurchaseOrderItem[],orders?:Order};type OrderNote={id:string,order_id:string,note:string,created_at:string,created_by:string|null};type Item={id:string,order_id:string,product_id:string|null,item_type:string,description:string,sku:string|null,vendor:string|null,qty:number,sell_price:number,cost:number|null,purchasing_status:string,tracking:string|null,notes:string|null};
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
export default function Dashboard({email}:{email:string}){
const s=supabase(),r=useRouter();
const [tab,setTab]=useState('Dashboard');
const [module,setModule]=useState('Sales');
const [customers,setCustomers]=useState<Customer[]>([]);
const [employees,setEmployees]=useState<Employee[]>([]);
const [products,setProducts]=useState<Product[]>([]);
const [orders,setOrders]=useState<Order[]>([]);
 const [adjustmentPayment,setAdjustmentPayment]=useState<Payment|null>(null);
const [purchaseOrders,setPurchaseOrders]=useState<PurchaseOrder[]>([]);

const [selected,setSelected]=useState<Order|null>(null);
const [selectedPO,setSelectedPO]=useState<PurchaseOrder|null>(null);
const [editingCustomer,setEditingCustomer]=useState<Customer|null>(null);
const [editingEmployee,setEditingEmployee]=useState<Employee|null>(null);

const [modal,setModal]=useState('');
const [search,setSearch]=useState('');

