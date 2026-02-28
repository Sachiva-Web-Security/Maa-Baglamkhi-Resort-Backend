import React, { useEffect, useState } from "react";
import API from "../api";

const Kitchen = () => {

const [orders,setOrders] = useState([]);

useEffect(()=>{
  fetchOrders();
},[]);


// ================= FETCH ORDERS =================
const fetchOrders = async ()=>{
  try{
    const res = await API.get("/kitchen/orders");
    setOrders(res.data);
  }catch(err){
    console.log(err);
  }
}


// ================= MARK READY =================
const markReady = async(id)=>{
  try{

    await API.put(`/kitchen/orders/${id}`,{
      status:"Ready"
    });

    fetchOrders();

  }catch(err){
    console.log(err);
  }
}


return (

<div className="p-6">

{/* HEADER */}

<div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-2xl shadow-lg mb-6">
<h2 className="text-2xl font-bold">Kitchen Orders</h2>
<p className="text-sm opacity-90">
Manage restaurant food orders
</p>
</div>


{/* TABLE */}

<div className="bg-white rounded-2xl shadow-md p-6">

<h3 className="text-lg font-semibold mb-4">Kitchen Orders</h3>

<div className="overflow-x-auto">

<table className="w-full border-collapse">

<thead>

<tr className="bg-gray-100 text-left">
<th className="p-3">Waiter</th>
<th className="p-3">Table</th>
<th className="p-3">Item</th>
<th className="p-3">Status</th>
<th className="p-3">Action</th>
</tr>

</thead>

<tbody>

{orders.map((o)=>(

<tr key={o.id} className="border-b hover:bg-gray-50 transition">

<td className="p-3 font-medium">{o.waiter_name}</td>
<td className="p-3">{o.table_number}</td>

<td className="p-3">
{o.items?.map((item,i)=>(
<div key={i}>
{item.name} x {item.quantity}
</div>
))}
</td>

<td className="p-3">

<span
className={`px-3 py-1 rounded-full text-xs font-semibold
${
o.status === "Ready"
? "bg-green-100 text-green-700"
: "bg-yellow-100 text-yellow-700"
}`}
>

{o.status}

</span>

</td>

<td className="p-3">

{o.status !== "Ready" && (

<button
onClick={()=>markReady(o.id)}
className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
>

Ready

</button>

)}

</td>

</tr>

))}

{orders.length === 0 && (

<tr>
<td colSpan="5" className="text-center p-4 text-gray-500">
No orders yet
</td>
</tr>

)}

</tbody>

</table>

</div>

</div>

</div>

);

};

export default Kitchen;