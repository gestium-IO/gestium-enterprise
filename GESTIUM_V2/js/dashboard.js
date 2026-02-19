// ═══════════════════════════════════════════════════════
//  GESTIUM · dashboard.js
//  Dashboard con datos en tiempo real via onSnapshot
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import {
  collection, query, orderBy, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, clp } from './utils.js';

const P = {
  teal:'#06d6c8', teal2:'#22d3ee', teal3:'#67e8f9',
  orange:'#f97316', amber:'#f59e0b', red:'#ef4444',
  green:'#10b981', navy:'#0d1629', gray:'#64748b', gray2:'#94a3b8'
};
const PALETTE = [P.teal,P.orange,P.amber,P.green,P.teal2,'#8b5cf6','#ec4899',P.gray2];

let _empresaId  = null;
let _unsub      = null;
let chartV = null, chartC = null, chartE = null;
let filtroCliente = "";
let _mesActual  = null;

export function initDashboard(empresaId) {
  _empresaId = empresaId;
}

export function setFiltroCliente(c) { filtroCliente = c; }
export function getFiltroCliente()  { return filtroCliente; }

/* ── SUSCRIBIR DASHBOARD EN TIEMPO REAL ── */
export function suscribirDashboard() {
  if (!_empresaId) return;
  if (_unsub) _unsub();

  const mesInput = $("mesReporte");
  if (!mesInput?.value) {
    const h = new Date();
    mesInput.value = `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,"0")}`;
  }
  _mesActual = mesInput?.value;

  _unsub = onSnapshot(
    query(
      collection(db,"empresas",_empresaId,"cotizaciones"),
      where("eliminado","!=",true),
      orderBy("eliminado"),
      orderBy("fecha","desc")
    ),
    snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      calcularYRender(docs);
    },
    err => console.warn("[Dashboard] onSnapshot error:", err.message)
  );
}

export function desuscribirDashboard() {
  if (_unsub) { _unsub(); _unsub = null; }
}

/* ── ACTUALIZAR MANUAL ── */
export function actualizarDashboard() {
  suscribirDashboard();
}

/* ── CÁLCULO Y RENDER ── */
function calcularYRender(docs) {
  const mesInput = $("mesReporte");
  _mesActual = mesInput?.value || _mesActual;
  if (!_mesActual) return;

  const anio = Number(_mesActual.substring(0,4));
  const mes  = Number(_mesActual.substring(5,7)) - 1;

  let cotizTotal = 0, vendidoTotal = 0, cant = 0;
  const ventasMes = [], estCount = {};

  docs.forEach(v => {
    if (!v?.fecha) return;
    const f = v.fecha.toDate();
    if (f.getFullYear() !== anio || f.getMonth() !== mes) return;
    const e = v.estado || "Pendiente";
    estCount[e] = (estCount[e]||0)+1;
    if (filtroCliente && String(v.cliente||"").trim().toLowerCase() !== filtroCliente.toLowerCase()) return;
    cotizTotal += Number(v.total||0); cant++;
    if (v.estado === "Convertida") { vendidoTotal += Number(v.total||0); ventasMes.push(v); }
  });

  // KPIs
  if ($("kpiCotizado"))  $("kpiCotizado").textContent  = clp(cotizTotal);
  if ($("kpiVentas"))    $("kpiVentas").textContent    = clp(vendidoTotal);
  if ($("kpiConversion")) $("kpiConversion").textContent = (cotizTotal > 0 ? ((vendidoTotal/cotizTotal)*100).toFixed(1) : 0) + "%";
  if ($("kpiCantidad"))  $("kpiCantidad").textContent  = cant;
  if ($("kpiPromedio"))  $("kpiPromedio").textContent  = cant > 0 ? clp(cotizTotal/cant) : "$ 0";

  if (!ventasMes.length) {
    [chartV,chartC,chartE].forEach(c => { if(c) c.destroy(); });
    chartV = chartC = chartE = null;
    renderEstados(estCount);
    return;
  }

  const vpd = {}, vpc = {};
  ventasMes.forEach(v => {
    const f = v.fecha.toDate ? v.fecha.toDate() : new Date(v.fecha);
    const dia = f.getDate();
    vpd[dia] = (vpd[dia]||0) + Number(v.total||0);
    vpc[v.cliente||"Sin cliente"] = (vpc[v.cliente||"Sin cliente"]||0) + Number(v.total||0);
  });
  const dias = Object.keys(vpd).map(Number).sort((a,b)=>a-b);

  // Gráfico de barras — ventas por día
  if (chartV) chartV.destroy();
  const cv = $("graficoVentas"); if (cv) { cv.style.height="280px";
    chartV = new Chart(cv.getContext("2d"), {
      type:"bar",
      data:{ labels:dias.map(d=>"D"+d), datasets:[{ label:"Ventas", data:dias.map(d=>vpd[d]),
        backgroundColor:dias.map((_,i)=>i%2===0?P.teal:P.orange),
        borderRadius:{topLeft:6,topRight:6}, borderSkipped:false,
        barPercentage:.6, categoryPercentage:.7, borderWidth:0 }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false},
          tooltip:{ backgroundColor:P.navy, titleColor:P.teal, bodyColor:"#e2e8f0", padding:12, displayColors:false,
            callbacks:{ title:c=>"Día "+c[0].label.replace("D",""), label:c=>"Ventas: "+clp(c.raw) } }},
        scales:{ x:{ grid:{display:false}, ticks:{font:{size:10,family:"Syne",weight:"700"},color:P.gray2}, border:{display:false} },
          y:{ beginAtZero:true, grid:{color:"rgba(255,255,255,.04)"},
            ticks:{font:{size:10,family:"JetBrains Mono"},color:P.gray2, callback:v=>"$"+Number(v/1000000).toFixed(1)+"M"},
            border:{display:false} }},
        animation:{ duration:500 } }
    });
  }

  // Donut — ventas por cliente
  const clsCli = Object.keys(vpc);
  if (chartC) chartC.destroy();
  if (clsCli.length) {
    const cc = $("graficoClientes"); if (cc) { cc.style.height="270px";
      chartC = new Chart(cc, {
        type:"doughnut",
        data:{ labels:clsCli, datasets:[{ data:clsCli.map(c=>vpc[c]), backgroundColor:PALETTE, borderColor:P.navy, borderWidth:3, hoverOffset:14 }]},
        options:{ responsive:true, maintainAspectRatio:false, cutout:"70%",
          plugins:{ legend:{ position:"right", labels:{boxWidth:10,padding:12,font:{size:11,family:"Syne",weight:"700"},color:"#e2e8f0"}},
            tooltip:{ backgroundColor:P.navy, titleColor:P.teal, bodyColor:"#e2e8f0", padding:12,
              callbacks:{ label:c=>`${c.label}: ${clp(c.raw)}` } }},
          animation:{ animateScale:true, duration:800 },
          onClick:(evt)=>{
            const pts = chartC.getElementsAtEventForMode(evt,"nearest",{intersect:true},true);
            filtroCliente = pts.length ? (filtroCliente===clsCli[pts[0].index]?"":clsCli[pts[0].index]) : "";
            $("graficoClientes")?.parentElement?.parentElement?.classList.toggle("filtro-on", !!filtroCliente);
            suscribirDashboard();
          } }
      });
    }
  }

  renderEstados(estCount);
}

function renderEstados(estCount) {
  const estL = Object.keys(estCount);
  const estC = { "Convertida":P.teal, "Pendiente":P.gray, "En espera":P.amber, "Cancelada":P.red };
  if (chartE) chartE.destroy();
  if (!estL.length) return;
  const ce = $("graficoEstados"); if (!ce) return; ce.style.height="270px";
  chartE = new Chart(ce, {
    type:"doughnut",
    data:{ labels:estL, datasets:[{ data:estL.map(e=>estCount[e]),
      backgroundColor:estL.map(e=>estC[e]||P.gray2), borderColor:P.navy, borderWidth:3, hoverOffset:10 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:"65%",
      plugins:{ legend:{ position:"right", labels:{boxWidth:10,padding:12,font:{size:11,family:"Syne",weight:"700"},color:"#e2e8f0"}},
        tooltip:{ backgroundColor:P.navy, titleColor:P.orange, bodyColor:"#e2e8f0", padding:12,
          callbacks:{ label:c=>`${c.label}: ${c.raw}` } }},
      animation:{ animateScale:true, duration:700 } }
  });
}
