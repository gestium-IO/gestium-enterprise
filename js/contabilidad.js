// ═══════════════════════════════════════════════════════
//  GESTIUM · contabilidad.js
//  Módulo Contable Super Premium
//  Nivel 1: Base obligatoria
//  Nivel 2: Funciones avanzadas
//  Nivel 3: Inteligencia financiera
// ═══════════════════════════════════════════════════════

import { db } from './firebase.js';
import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc,
  query, orderBy, where, limit, Timestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { $, clp, fmt, fmtShort, toast, softDeleteUpdate, logError } from './utils.js';
import { hasPermission, hasFeature, getLimits } from './features.js';
import { escribirLog } from './logs.js';
import { pushNotif } from './ui.js';

let _empId = null;
let _emp   = null;
let _usr   = null;
let _unsubContab = null;

// ══════════════════════════════════════════════════════
// PLAN DE CUENTAS CONTABLE (Colombia — PUC simplificado)
// ══════════════════════════════════════════════════════
export const PLAN_CUENTAS = {
  "1105": { nombre:"Caja",                   tipo:"activo",    naturaleza:"debito"  },
  "1110": { nombre:"Bancos",                 tipo:"activo",    naturaleza:"debito"  },
  "1305": { nombre:"Clientes (CxC)",         tipo:"activo",    naturaleza:"debito"  },
  "1330": { nombre:"Anticipos de clientes",  tipo:"activo",    naturaleza:"debito"  },
  "1524": { nombre:"Equipos y maquinaria",   tipo:"activo",    naturaleza:"debito"  },
  "1792": { nombre:"Gastos pagados anticipo",tipo:"activo",    naturaleza:"debito"  },
  "2205": { nombre:"Proveedores (CxP)",      tipo:"pasivo",    naturaleza:"credito" },
  "2365": { nombre:"IVA por pagar",          tipo:"pasivo",    naturaleza:"credito" },
  "2367": { nombre:"Retenciones por pagar",  tipo:"pasivo",    naturaleza:"credito" },
  "2370": { nombre:"ICA por pagar",          tipo:"pasivo",    naturaleza:"credito" },
  "3105": { nombre:"Capital social",         tipo:"patrimonio",naturaleza:"credito" },
  "3605": { nombre:"Utilidad del ejercicio", tipo:"patrimonio",naturaleza:"credito" },
  "4135": { nombre:"Ingresos por ventas",    tipo:"ingreso",   naturaleza:"credito" },
  "4175": { nombre:"Servicios",              tipo:"ingreso",   naturaleza:"credito" },
  "5105": { nombre:"Materia prima / costos", tipo:"gasto",     naturaleza:"debito"  },
  "5205": { nombre:"Nómina y salarios",      tipo:"gasto",     naturaleza:"debito"  },
  "5245": { nombre:"Transporte",             tipo:"gasto",     naturaleza:"debito"  },
  "5295": { nombre:"Servicios públicos",     tipo:"gasto",     naturaleza:"debito"  },
  "5305": { nombre:"Gastos diversos",        tipo:"gasto",     naturaleza:"debito"  },
  "5310": { nombre:"Depreciaciones",         tipo:"gasto",     naturaleza:"debito"  },
};

const CATEGORIAS_GASTO_CUENTA = {
  "Materia Prima":"5105","Transporte":"5245","Nómina":"5205","Servicios":"5295","Otros":"5305"
};

export function initContabilidad(empId, emp, usr) {
  _empId = empId; _emp = emp; _usr = usr;
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · LIBRO DIARIO — escritura automática
// ══════════════════════════════════════════════════════
export async function crearAsientoAutomatico(tipo, datos) {
  if (!_empId) return;
  let asiento = null;

  if (tipo === "venta_confirmada") {
    // Débito: CxC | Crédito: Ingresos + IVA
    asiento = {
      fecha:   Timestamp.fromDate(new Date()),
      tipo:    "venta_confirmada",
      ref:     datos.numero || "",
      tercero: datos.cliente || "",
      descripcion: `Venta confirmada ${datos.numero} — ${datos.cliente}`,
      lineas: [
        { cuenta:"1305", nombre:"Clientes (CxC)",   tipo:"debito",  valor: datos.total },
        { cuenta:"4135", nombre:"Ingresos x ventas", tipo:"credito", valor: datos.subtotal },
        { cuenta:"2365", nombre:"IVA por pagar",     tipo:"credito", valor: datos.iva },
      ],
      total: datos.total,
      cuadrado: Math.abs(datos.total - datos.subtotal - datos.iva) < 1,
      creadoEn: Timestamp.fromDate(new Date()),
    };
  }

  if (tipo === "pago_recibido") {
    asiento = {
      fecha:   Timestamp.fromDate(new Date()),
      tipo:    "pago_recibido",
      ref:     datos.ref || "",
      tercero: datos.cliente || "",
      descripcion: `Pago recibido — ${datos.cliente}`,
      lineas: [
        { cuenta:"1110", nombre:"Bancos",        tipo:"debito",  valor: datos.valor },
        { cuenta:"1305", nombre:"Clientes (CxC)",tipo:"credito", valor: datos.valor },
      ],
      total: datos.valor,
      cuadrado: true,
      creadoEn: Timestamp.fromDate(new Date()),
    };
  }

  if (tipo === "gasto_registrado") {
    const cta = CATEGORIAS_GASTO_CUENTA[datos.categoria] || "5305";
    const ctaNombre = PLAN_CUENTAS[cta]?.nombre || "Gasto";
    asiento = {
      fecha:   Timestamp.fromDate(new Date()),
      tipo:    "gasto_registrado",
      ref:     datos.ref || "",
      tercero: datos.cliente || datos.proveedor || "",
      descripcion: `Gasto: ${datos.categoria} — ${datos.descripcion || ""}`,
      lineas: [
        { cuenta: cta,    nombre: ctaNombre,         tipo:"debito",  valor: datos.valor },
        { cuenta:"1110",  nombre:"Bancos",            tipo:"credito", valor: datos.valor },
      ],
      total: datos.valor,
      cuadrado: true,
      creadoEn: Timestamp.fromDate(new Date()),
    };
  }

  if (tipo === "nota_credito") {
    asiento = {
      fecha:   Timestamp.fromDate(new Date()),
      tipo:    "nota_credito",
      ref:     datos.ref || "",
      tercero: datos.cliente || "",
      descripcion: `Nota crédito — ${datos.cliente}`,
      lineas: [
        { cuenta:"4135", nombre:"Ingresos x ventas", tipo:"debito",  valor: datos.valor },
        { cuenta:"1305", nombre:"Clientes (CxC)",    tipo:"credito", valor: datos.valor },
      ],
      total: datos.valor,
      cuadrado: true,
      creadoEn: Timestamp.fromDate(new Date()),
    };
  }

  if (asiento) {
    try {
      // 🔴 CRÍTICO: Validar doble partida SIEMPRE
      const debitos = asiento.lineas
        .filter(l => l.tipo === "debito")
        .reduce((s, l) => s + Number(l.valor || 0), 0);
      const creditos = asiento.lineas
        .filter(l => l.tipo === "credito")
        .reduce((s, l) => s + Number(l.valor || 0), 0);
      
      if (Math.abs(debitos - creditos) > 1) {
        throw new Error("Asiento descuadrado: débitos " + debitos + " ≠ créditos " + creditos);
      }
      
      // 🔴 CRÍTICO: Prevenir duplicados
      if (datos.id) {
        const q = query(
          collection(db,"empresas",_empId,"libroDiario"),
          where("origenId","==",datos.id),
          where("tipo","==",tipo)
        );
        const existe = await getDocs(q);
        if (!existe.empty) {
          console.warn("Asiento ya existe para", tipo, datos.id);
          return;
        }
      }
      
      // Agregar origen para trazabilidad
      asiento.origenTipo = tipo;
      asiento.origenId = datos.id || "";
      asiento.cuadrado = true;
      
      await addDoc(collection(db,"empresas",_empId,"libroDiario"), asiento);
    } catch(e) {
      await logError("asiento_fallido", e.message, datos, {empresaId:_empId});
      throw e; // Re-throw para que el caller sepa que falló
    }
  }
}

// Asiento manual
export async function crearAsientoManual(datos) {
  if (!hasPermission("crear_asiento")) { toast("Sin permiso para crear asientos","warn"); return false; }
  const debitos  = datos.lineas.filter(l=>l.tipo==="debito").reduce((s,l)=>s+Number(l.valor||0),0);
  const creditos = datos.lineas.filter(l=>l.tipo==="credito").reduce((s,l)=>s+Number(l.valor||0),0);
  if (Math.abs(debitos-creditos) > 1) {
    toast(`Asiento NO cuadra. Débitos: ${clp(debitos)} — Créditos: ${clp(creditos)}`,"error");
    return false;
  }
  await addDoc(collection(db,"empresas",_empId,"libroDiario"), {
    ...datos,
    fecha: Timestamp.fromDate(new Date(datos.fecha || Date.now())),
    cuadrado: true,
    creadoEn: Timestamp.fromDate(new Date()),
    manual: true,
  });
  await escribirLog("asiento_manual_creado", `Creó asiento manual: ${datos.descripcion}`);
  toast("Asiento creado ✓","success");
  return true;
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · ESTADO DE RESULTADOS
// ══════════════════════════════════════════════════════
export async function calcularEstadoResultados(mes) {
  const [anio, mesN] = mes.split("-").map(Number);
  const inicioMes = new Date(anio, mesN-1, 1);
  const finMes = new Date(anio, mesN, 0, 23, 59, 59);
  
  // 🔴 CRÍTICO: Filtrar por fecha en query, no en cliente
  const snap = await getDocs(
    query(
      collection(db,"empresas",_empId,"libroDiario"),
      where("fecha", ">=", Timestamp.fromDate(inicioMes)),
      where("fecha", "<=", Timestamp.fromDate(finMes)),
      orderBy("fecha", "desc"),
      limit(500) // Safety limit
    )
  );
  
  let ingresos=0, costos=0, gastos=0;
  snap.forEach(d => {
    const doc = d.data();
    doc.lineas?.forEach(l => {
      const cta = PLAN_CUENTAS[l.cuenta];
      if (!cta) return;
      const val = Number(l.valor||0);
      if (cta.tipo==="ingreso" && l.tipo==="credito") ingresos += val;
      if (cta.tipo==="gasto"   && l.tipo==="debito")  { if(["5105"].includes(l.cuenta)) costos+=val; else gastos+=val; }
    });
  });
  const utilidadBruta  = ingresos - costos;
  const utilidadOperativa = utilidadBruta - gastos;
  const impuestos = Math.max(0, utilidadOperativa * 0.30); // 30% aprox
  const utilidadNeta = utilidadOperativa - impuestos;
  return { ingresos, costos, gastos, utilidadBruta, utilidadOperativa, impuestos, utilidadNeta,
    margenBruto: ingresos>0?(utilidadBruta/ingresos*100):0,
    margenNeto:  ingresos>0?(utilidadNeta/ingresos*100):0,
  };
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · BALANCE GENERAL
// ══════════════════════════════════════════════════════
export async function calcularBalance() {
  // 🔴 NOTA: Balance requiere TODOS los asientos históricos
  // En producción con >10k asientos, considerar:
  // 1. Cálculo serverless mensual
  // 2. Guardar saldos en documento empresas/saldos/{mes}
  // 3. Leer solo último saldo + asientos del mes actual
  const snap = await getDocs(
    query(
      collection(db,"empresas",_empId,"libroDiario"),
      orderBy("fecha", "asc"),
      limit(5000) // Safety: revisar si empresa tiene más de 5k asientos
    )
  );
  const saldos = {};
  Object.keys(PLAN_CUENTAS).forEach(c => saldos[c]=0);
  snap.forEach(d => {
    d.data().lineas?.forEach(l => {
      if (!saldos[l.cuenta] && saldos[l.cuenta]!==0) saldos[l.cuenta]=0;
      const cta = PLAN_CUENTAS[l.cuenta];
      if (!cta) return;
      const val = Number(l.valor||0);
      if (cta.naturaleza==="debito") {
        saldos[l.cuenta] += l.tipo==="debito" ? val : -val;
      } else {
        saldos[l.cuenta] += l.tipo==="credito" ? val : -val;
      }
    });
  });
  let activos=0, pasivos=0, patrimonio=0;
  Object.entries(PLAN_CUENTAS).forEach(([cod,cta]) => {
    const s = saldos[cod]||0;
    if (cta.tipo==="activo")     activos    += s;
    if (cta.tipo==="pasivo")     pasivos    += s;
    if (cta.tipo==="patrimonio") patrimonio += s;
  });
  return { activos, pasivos, patrimonio, cuadrado: Math.abs(activos-(pasivos+patrimonio))<1, saldos };
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · FLUJO DE CAJA REAL
// ══════════════════════════════════════════════════════
export async function calcularFlujoCaja(mes) {
  const [anio, mesN] = mes.split("-").map(Number);
  const inicioMes = new Date(anio, mesN-1, 1);
  const finMes    = new Date(anio, mesN, 0, 23, 59, 59);
  // ✅ FIX: filtro por fecha en query, no en cliente (escalabilidad)
  const snap = await getDocs(
    query(
      collection(db,"empresas",_empId,"libroDiario"),
      where("fecha", ">=", Timestamp.fromDate(inicioMes)),
      where("fecha", "<=", Timestamp.fromDate(finMes)),
      orderBy("fecha","asc")
    )
  );
  let entradas=0, salidas=0;
  snap.forEach(d => {
    const doc = d.data();
    doc.lineas?.forEach(l => {
      if (l.cuenta==="1110" || l.cuenta==="1105") {
        const val = Number(l.valor||0);
        if (l.tipo==="debito")  entradas+=val;
        if (l.tipo==="credito") salidas+=val;
      }
    });
  });
  return { entradas, salidas, saldo: entradas - salidas };
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · CUENTAS POR COBRAR Y PAGAR
// ══════════════════════════════════════════════════════
export async function cargarCxCyP() {
  // ✅ FIX: CxC usa últimos 90 días (cartera activa real), no toda la historia
  // CxC histórica ilimitada no tiene sentido operativo — facturas viejas ya están cobradas
  const hoy = new Date();
  const inicio90 = new Date(hoy); inicio90.setDate(inicio90.getDate() - 90);
  const inicio30 = new Date(hoy); inicio30.setDate(inicio30.getDate() - 30);

  const [cotsSnap, gastosSnap] = await Promise.all([
    getDocs(
      query(
        collection(db,"empresas",_empId,"cotizaciones"),
        where("estado","==","Convertida"),
        where("fecha",">=",Timestamp.fromDate(inicio90)),
        where("eliminado","!=",true),
        orderBy("eliminado"),
        orderBy("fecha","desc"),
        limit(200)
      )
    ),
    getDocs(
      query(
        collection(db,"empresas",_empId,"gastos"),
        where("fecha",">=",Timestamp.fromDate(inicio30)),
        where("eliminado","==",false),
        orderBy("fecha","desc"),
        limit(100)
      )
    )
  ]);

  const porCobrar = [], porPagar = [];

  cotsSnap.forEach(d => {
    const v = d.data(); if (!v.fecha) return;
    const diasVenc = v.vencimientoCxC
      ? Math.ceil((v.vencimientoCxC.toDate()-new Date())/(86400000))
      : null;
    if (!v.pagada) {
      porCobrar.push({
        id:d.id, numero:v.numero, cliente:v.cliente,
        total:v.total, fecha:v.fecha.toDate(),
        diasVenc, estado: diasVenc!=null&&diasVenc<0?"Vencida":"Pendiente"
      });
    }
  });

  gastosSnap.forEach(d => {
    const g = d.data(); if (!g.fecha) return;
    if (!g.pagado) porPagar.push({
      id:d.id, proveedor:g.cliente||g.proveedor||"—",
      valor:g.valor, fecha:g.fecha.toDate(), categoria:g.categoria
    });
  });

  return { porCobrar, porPagar };
}

// ══════════════════════════════════════════════════════
// NIVEL 1 · IMPUESTOS AUTOMÁTICOS
// ══════════════════════════════════════════════════════
export async function calcularImpuestos(mes) {
  const [anio, mesN] = mes.split("-").map(Number);
  const inicioMes = new Date(anio, mesN-1, 1);
  const finMes    = new Date(anio, mesN, 0, 23, 59, 59);
  // ✅ FIX: filtro por fecha en query
  const snap = await getDocs(
    query(
      collection(db,"empresas",_empId,"libroDiario"),
      where("fecha", ">=", Timestamp.fromDate(inicioMes)),
      where("fecha", "<=", Timestamp.fromDate(finMes)),
      orderBy("fecha","asc")
    )
  );
  let iva=0, retenciones=0, ica=0;
  snap.forEach(d => {
    const doc = d.data();
    doc.lineas?.forEach(l => {
      if(l.cuenta==="2365"&&l.tipo==="credito") iva+=Number(l.valor||0);
      if(l.cuenta==="2367"&&l.tipo==="credito") retenciones+=Number(l.valor||0);
      if(l.cuenta==="2370"&&l.tipo==="credito") ica+=Number(l.valor||0);
    });
  });
  // ICA estimado: 4.14‰ sobre ingresos
  const ingSnap = await calcularEstadoResultados(mes);
  ica = Math.round(ingSnap.ingresos * 0.00414);
  return { iva, retenciones, ica, total: iva+retenciones+ica };
}

// ══════════════════════════════════════════════════════
// NIVEL 2 · FLUJO DE CAJA PREDICTIVO 30/60/90 días
// ══════════════════════════════════════════════════════
export async function proyectarFlujoCaja() {
  // Obtener promedios históricos de los últimos 3 meses
  const snap = await getDocs(collection(db,"empresas",_empId,"libroDiario"));
  const entPromedio=[], salPromedio=[];
  for(let m=1;m<=3;m++) {
    const ref = new Date(); ref.setMonth(ref.getMonth()-m);
    const key = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}`;
    const f = await calcularFlujoCaja(key);
    entPromedio.push(f.entradas); salPromedio.push(f.salidas);
  }
  const avgEnt = entPromedio.reduce((a,b)=>a+b,0)/entPromedio.length || 0;
  const avgSal = salPromedio.reduce((a,b)=>a+b,0)/salPromedio.length || 0;
  const cxcRes = await cargarCxCyP();
  const pendientesCobro = cxcRes.porCobrar.reduce((s,c)=>s+Number(c.total||0),0);
  const pendientesPago  = cxcRes.porPagar.reduce((s,p)=>s+Number(p.valor||0),0);
  const saldoActual = (await calcularFlujoCaja(
    `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`
  )).saldo;

  const proyeccion = [30,60,90].map(dias => {
    const meses = dias/30;
    const ent = saldoActual + pendientesCobro + avgEnt*meses*0.7;
    const sal = pendientesPago + avgSal*meses;
    return { dias, entradas:Math.round(ent), salidas:Math.round(sal), saldo:Math.round(ent-sal) };
  });

  // Alertas automáticas
  proyeccion.forEach(p => {
    if (p.saldo < 0) {
      pushNotif("⚠️", `Flujo de caja negativo proyectado a ${p.dias} días: ${clp(p.saldo)}`, "warn");
      escribirLog("alerta_financiera", `Flujo de caja negativo proyectado a ${p.dias} días`);
    }
  });

  return { proyeccion, avgEnt, avgSal, saldoActual, pendientesCobro, pendientesPago };
}

// ══════════════════════════════════════════════════════
// NIVEL 2 · ALERTAS FINANCIERAS AUTOMÁTICAS
// ══════════════════════════════════════════════════════
export async function verificarAlertasFinancieras() {
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const er   = await calcularEstadoResultados(mes);
  const imp  = await calcularImpuestos(mes);
  const cxc  = await cargarCxCyP();
  const alertas = [];

  // Margen negativo
  if (er.margenNeto < -5) {
    alertas.push({ tipo:"critica", icon:"🔴", msg:`Margen neto negativo: ${er.margenNeto.toFixed(1)}%` });
    pushNotif("🔴", `Alerta: margen neto negativo (${er.margenNeto.toFixed(1)}%)`, "error");
  }

  // Cartera vencida
  const carteraVencida = cxc.porCobrar.filter(c=>c.estado==="Vencida");
  if (carteraVencida.length) {
    const total = carteraVencida.reduce((s,c)=>s+Number(c.total||0),0);
    alertas.push({ tipo:"advertencia", icon:"⚠️", msg:`Cartera vencida: ${carteraVencida.length} facturas por ${clp(total)}` });
    pushNotif("⚠️", `Cartera vencida: ${clp(total)}`, "warn");
  }

  // IVA próximo a vencer (último día del mes)
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
  const diasFinMes = Math.ceil((finMes-hoy)/86400000);
  if (diasFinMes <= 5 && imp.iva > 0) {
    alertas.push({ tipo:"advertencia", icon:"📅", msg:`IVA por declarar: ${clp(imp.iva)} — vence en ${diasFinMes} días` });
    pushNotif("📅", `IVA pendiente: ${clp(imp.iva)}`, "warn");
  }

  // Gastos fuera del promedio
  const snapG = await getDocs(
    query(collection(db,"empresas",_empId,"gastos"), where("eliminado","!=",true), orderBy("eliminado"))
  );
  let totalGastosMes=0, cnt=0;
  snapG.forEach(d => {
    const g = d.data(); if(!g.fecha) return;
    const f = g.fecha.toDate();
    if(f.getFullYear()===hoy.getFullYear()&&f.getMonth()===hoy.getMonth()) { totalGastosMes+=Number(g.valor||0); cnt++; }
  });
  if (cnt && er.ingresos && totalGastosMes / er.ingresos > 0.7) {
    alertas.push({ tipo:"advertencia", icon:"📊", msg:`Gastos representan ${(totalGastosMes/er.ingresos*100).toFixed(0)}% de ingresos del mes` });
  }

  // Guardar en Firestore
  if (alertas.length) {
    await addDoc(collection(db,"empresas",_empId,"alertasContables"), {
      fecha: Timestamp.fromDate(new Date()),
      alertas,
      mes,
    });
  }

  return alertas;
}

// ══════════════════════════════════════════════════════
// NIVEL 2 · RENTABILIDAD POR CLIENTE
// ══════════════════════════════════════════════════════
export async function calcularRentabilidadClientes() {
  const [cotsSnap, gastosSnap] = await Promise.all([
    getDocs(query(collection(db,"empresas",_empId,"cotizaciones"), where("estado","==","Convertida"), where("eliminado","!=",true), orderBy("eliminado"))),
    getDocs(query(collection(db,"empresas",_empId,"gastos"), where("eliminado","!=",true), orderBy("eliminado"))),
  ]);
  const clientes = {};
  cotsSnap.forEach(d => {
    const v = d.data(); if(!v.cliente) return;
    if (!clientes[v.cliente]) clientes[v.cliente] = { ingresos:0, costos:0, cotizaciones:0 };
    clientes[v.cliente].ingresos += Number(v.total||0);
    clientes[v.cliente].cotizaciones++;
  });
  gastosSnap.forEach(d => {
    const g = d.data(); if(!g.cliente) return;
    if (clientes[g.cliente]) clientes[g.cliente].costos += Number(g.valor||0);
  });
  return Object.entries(clientes).map(([nombre, data]) => ({
    nombre,
    ingresos: data.ingresos,
    costos: data.costos,
    margen: data.ingresos>0?((data.ingresos-data.costos)/data.ingresos*100):0,
    utilidad: data.ingresos - data.costos,
    cotizaciones: data.cotizaciones,
  })).sort((a,b) => b.margen - a.margen);
}

// ══════════════════════════════════════════════════════
// NIVEL 2 · CIERRE CONTABLE ASISTIDO
// ══════════════════════════════════════════════════════
export async function verificarPreCierre(mes) {
  const tareas = [];
  const [anio, mesN] = mes.split("-").map(Number);
  const inicioMes = new Date(anio, mesN-1, 1);
  const finMes    = new Date(anio, mesN, 0, 23, 59, 59);
  // ✅ FIX: filtro por fecha en query
  const snap = await getDocs(
    query(
      collection(db,"empresas",_empId,"libroDiario"),
      where("fecha", ">=", Timestamp.fromDate(inicioMes)),
      where("fecha", "<=", Timestamp.fromDate(finMes)),
      orderBy("fecha","asc")
    )
  );
  let sinClasificar=0, cuadrados=0, total=0;
  snap.forEach(d => {
    const doc=d.data();
    total++;
    if(!doc.cuadrado) sinClasificar++;
    else cuadrados++;
  });
  if (sinClasificar > 0) tareas.push({ ok:false, msg:`${sinClasificar} asientos no cuadrados — revisar` });
  else if (total > 0)    tareas.push({ ok:true,  msg:`Todos los asientos cuadrados (${total})` });
  else                   tareas.push({ ok:false, msg:"Sin movimientos en el período" });

  const imp = await calcularImpuestos(mes);
  if (imp.iva > 0)         tareas.push({ ok:false, msg:`IVA por declarar: ${clp(imp.iva)}` });
  if (imp.retenciones > 0) tareas.push({ ok:false, msg:`Retenciones por pagar: ${clp(imp.retenciones)}` });

  const cxc = await cargarCxCyP();
  const vencidas = cxc.porCobrar.filter(c=>c.estado==="Vencida");
  if (vencidas.length) tareas.push({ ok:false, msg:`${vencidas.length} facturas vencidas sin cobrar` });
  else tareas.push({ ok:true, msg:"Sin cartera vencida" });

  const balance = await calcularBalance();
  if (balance.cuadrado) tareas.push({ ok:true, msg:"Balance cuadra ✓" });
  else                  tareas.push({ ok:false, msg:`Balance descuadrado: diferencia ${clp(Math.abs(balance.activos-(balance.pasivos+balance.patrimonio)))}` });

  const pendientesPago = cxc.porPagar.length;
  if (pendientesPago) tareas.push({ ok:false, msg:`${pendientesPago} gastos pendientes de pago` });

  return tareas;
}

// ══════════════════════════════════════════════════════
// NIVEL 2 · DASHBOARD FINANCIERO EJECUTIVO (KPIs)
// ══════════════════════════════════════════════════════
export async function calcularKPIsEjecutivos(mes) {
  const er  = await calcularEstadoResultados(mes);
  const fc  = await calcularFlujoCaja(mes);
  const bal = await calcularBalance();
  const cxc = await cargarCxCyP();

  // Días promedio de pago de clientes
  const snap = await getDocs(
    query(collection(db,"empresas",_empId,"cotizaciones"),
      where("estado","==","Convertida"), where("eliminado","!=",true), orderBy("eliminado"))
  );
  let sumDias=0, cntPagados=0;
  snap.forEach(d=>{
    const v=d.data();
    if(v.pagada && v.fechaPago && v.fecha){
      const dias=(v.fechaPago.toDate()-v.fecha.toDate())/86400000;
      sumDias+=dias; cntPagados++;
    }
  });
  const diasPagoPromedio = cntPagados>0?Math.round(sumDias/cntPagados):30;
  const rotacionCartera  = er.ingresos>0?Math.round(cxc.porCobrar.reduce((s,c)=>s+c.total,0)/er.ingresos*30):0;
  const ebitda = er.utilidadOperativa + (er.gastos*0.1); // aprox depreciación
  const liquidez = bal.activos>0?(bal.activos/Math.max(bal.pasivos,1)):0;
  const endeudamiento = bal.activos>0?(bal.pasivos/bal.activos*100):0;

  return {
    ebitda,
    margenBruto:    er.margenBruto,
    margenNeto:     er.margenNeto,
    rotacionCartera,
    diasPagoPromedio,
    liquidez:       liquidez.toFixed(2),
    endeudamiento:  endeudamiento.toFixed(1),
    ingresos:       er.ingresos,
    costos:         er.costos,
    gastos:         er.gastos,
    utilidadNeta:   er.utilidadNeta,
  };
}

// ══════════════════════════════════════════════════════
// NIVEL 3 · ANÁLISIS DE RIESGO POR CLIENTE (Score)
// ══════════════════════════════════════════════════════
export async function calcularRiesgoClientes() {
  const snap = await getDocs(
    query(collection(db,"empresas",_empId,"cotizaciones"),
      where("eliminado","!=",true), orderBy("eliminado"), orderBy("fecha","desc"))
  );
  const clientes = {};
  snap.forEach(d => {
    const v=d.data(); if(!v.cliente||!v.fecha) return;
    if(!clientes[v.cliente]) clientes[v.cliente]={total:0,vencidas:0,pagadas:0,diasMora:0,cnt:0};
    const c=clientes[v.cliente];
    c.total += Number(v.total||0); c.cnt++;
    if(v.estado==="Convertida"&&!v.pagada) {
      // 🔴 CRÍTICO: Usar fecha de vencimiento, no fecha de emisión
      // Si no existe vencimientoCxC, asumir 30 días desde fecha
      const fechaVencimiento = v.vencimientoCxC 
        ? v.vencimientoCxC.toDate() 
        : new Date(v.fecha.toDate().getTime() + 30*24*60*60*1000);
      const dias=(new Date()-fechaVencimiento)/86400000;
      if(dias>0){c.vencidas++;c.diasMora+=dias;}
    }
    if(v.pagada) c.pagadas++;
  });
  return Object.entries(clientes).map(([nombre,d])=>{
    const tasaMora = d.cnt>0?(d.vencidas/d.cnt*100):0;
    const promDias = d.vencidas>0?(d.diasMora/d.vencidas):0;
    let score = 100 - tasaMora*1.5 - Math.min(promDias,60)*0.5;
    score = Math.max(0,Math.min(100,Math.round(score)));
    const riesgo = score>=80?"Bajo":score>=60?"Medio":score>=40?"Alto":"Crítico";
    return { nombre, score, riesgo, tasaMora:tasaMora.toFixed(0), promDias:promDias.toFixed(0), total:d.total };
  }).sort((a,b)=>a.score-b.score);
}

// ══════════════════════════════════════════════════════
// NIVEL 3 · SIMULADOR FINANCIERO
// ══════════════════════════════════════════════════════
export async function simularEscenario(parametros) {
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const base = await calcularEstadoResultados(mes);
  const fc   = await calcularFlujoCaja(mes);

  const { pctIngreso=0, pctGasto=0, pctCosto=0, nuevoPersonal=0, salarioPersonal=4500000 } = parametros;

  const ingresosNuevos = base.ingresos * (1 + pctIngreso/100);
  const costosNuevos   = base.costos   * (1 + pctCosto/100);
  const gastosNuevos   = base.gastos   * (1 + pctGasto/100) + nuevoPersonal*salarioPersonal;

  const utilBrutaNueva   = ingresosNuevos - costosNuevos;
  const utilOperNueva    = utilBrutaNueva - gastosNuevos;
  const utilNetaNueva    = utilOperNueva * 0.70;
  const flujoCajaNuevo   = fc.saldo + (ingresosNuevos - base.ingresos) - (gastosNuevos - base.gastos);

  return {
    base: { ingresos:base.ingresos, costos:base.costos, gastos:base.gastos, utilidadNeta:base.utilidadNeta, flujoCaja:fc.saldo },
    nuevo: { ingresos:ingresosNuevos, costos:costosNuevos, gastos:gastosNuevos, utilidadNeta:utilNetaNueva, flujoCaja:flujoCajaNuevo },
    delta: {
      ingresos:   ingresosNuevos - base.ingresos,
      gastos:     gastosNuevos   - base.gastos,
      utilidad:   utilNetaNueva  - base.utilidadNeta,
      flujoCaja:  flujoCajaNuevo - fc.saldo,
    },
    riesgo: utilNetaNueva < 0 ? "Alto" : utilNetaNueva < base.utilidadNeta*0.5 ? "Medio" : "Bajo",
  };
}

// ══════════════════════════════════════════════════════
// RENDER DEL MÓDULO CONTABLE
// ══════════════════════════════════════════════════════
export async function renderContabilidad() {
  const cont = $("moduloContabilidad"); if(!cont) return;

  const mes = $("mesContab")?.value ||
    `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;

  // Cargar todos los datos en paralelo
  cont.querySelector("#contabLoading")?.style && (cont.querySelector("#contabLoading").style.display="block");

  const [er, bal, fc, imp, cxc, riesgo, rent, kpis] = await Promise.all([
    calcularEstadoResultados(mes),
    calcularBalance(),
    calcularFlujoCaja(mes),
    calcularImpuestos(mes),
    cargarCxCyP(),
    calcularRiesgoClientes(),
    calcularRentabilidadClientes(),
    calcularKPIsEjecutivos(mes),
  ]);

  // Verificar alertas
  verificarAlertasFinancieras().catch(()=>{});

  // KPI EJECUTIVOS
  const kpiBox = $("contabKpis"); if(kpiBox) kpiBox.innerHTML = `
    <div class="kpi k-teal"><div class="kpi-lbl">EBITDA</div><div class="kpi-val">${clp(Math.round(kpis.ebitda))}</div></div>
    <div class="kpi k-orange"><div class="kpi-lbl">Margen Bruto</div><div class="kpi-val">${kpis.margenBruto.toFixed(1)}%</div></div>
    <div class="kpi k-${kpis.margenNeto>=0?"green":"red"}"><div class="kpi-lbl">Margen Neto</div><div class="kpi-val">${kpis.margenNeto.toFixed(1)}%</div></div>
    <div class="kpi k-amber"><div class="kpi-lbl">Liquidez</div><div class="kpi-val">${kpis.liquidez}x</div></div>
    <div class="kpi k-purple"><div class="kpi-lbl">Endeudamiento</div><div class="kpi-val">${kpis.endeudamiento}%</div></div>
    <div class="kpi k-gray"><div class="kpi-lbl">Días cobro promedio</div><div class="kpi-val">${kpis.diasPagoPromedio}d</div></div>
  `;

  // ESTADO DE RESULTADOS
  const erBox = $("contabER"); if(erBox) erBox.innerHTML = `
    <table class="contab-table"><tbody>
      <tr class="ing"><td>📈 Ingresos por ventas</td><td class="monto pos">${clp(er.ingresos)}</td></tr>
      <tr class="cto"><td>📦 Costos de producción</td><td class="monto neg">(${clp(er.costos)})</td></tr>
      <tr class="sub"><td><strong>Utilidad Bruta</strong></td><td class="monto ${er.utilidadBruta>=0?"pos":"neg"}"><strong>${clp(er.utilidadBruta)}</strong></td></tr>
      <tr class="gto"><td>📋 Gastos operacionales</td><td class="monto neg">(${clp(er.gastos)})</td></tr>
      <tr class="sub"><td><strong>Utilidad Operativa</strong></td><td class="monto ${er.utilidadOperativa>=0?"pos":"neg"}"><strong>${clp(er.utilidadOperativa)}</strong></td></tr>
      <tr class="imp"><td>🏛 Impuestos estimados</td><td class="monto neg">(${clp(er.impuestos)})</td></tr>
      <tr class="tot"><td><strong>UTILIDAD NETA</strong></td><td class="monto ${er.utilidadNeta>=0?"pos":"neg"}"><strong>${clp(er.utilidadNeta)}</strong></td></tr>
      <tr><td colspan="2" style="height:8px"></td></tr>
      <tr><td style="font-size:11px;color:var(--text3)">Margen Bruto</td><td style="font-size:11px;color:var(--teal)">${er.margenBruto.toFixed(1)}%</td></tr>
      <tr><td style="font-size:11px;color:var(--text3)">Margen Neto</td><td style="font-size:11px;color:${er.margenNeto>=0?"var(--green)":"var(--red)"}">${er.margenNeto.toFixed(1)}%</td></tr>
    </tbody></table>`;

  // BALANCE GENERAL
  const balBox = $("contabBalance"); if(balBox) balBox.innerHTML = `
    <table class="contab-table"><tbody>
      <tr class="sec-header"><td colspan="2">ACTIVOS</td></tr>
      ${Object.entries(PLAN_CUENTAS).filter(([cod,c])=>c.tipo==="activo").map(([cod,c])=>{
        const s=bal.saldos[cod]||0; return s?`<tr><td class="cuenta">${cod} · ${c.nombre}</td><td class="monto">${clp(s)}</td></tr>`:"";
      }).join("")}
      <tr class="sub"><td>Total Activos</td><td class="monto pos"><strong>${clp(bal.activos)}</strong></td></tr>
      <tr class="sec-header"><td colspan="2">PASIVOS</td></tr>
      ${Object.entries(PLAN_CUENTAS).filter(([,c])=>c.tipo==="pasivo").map(([cod,c])=>{
        const s=bal.saldos[cod]||0; return s?`<tr><td class="cuenta">${cod} · ${c.nombre}</td><td class="monto">${clp(s)}</td></tr>`:"";
      }).join("")}
      <tr class="sub"><td>Total Pasivos</td><td class="monto neg"><strong>${clp(bal.pasivos)}</strong></td></tr>
      <tr class="sec-header"><td colspan="2">PATRIMONIO</td></tr>
      <tr class="sub"><td>Total Patrimonio</td><td class="monto pos"><strong>${clp(bal.patrimonio)}</strong></td></tr>
      <tr class="tot ${bal.cuadrado?"cuadra":"descuadra"}"><td>${bal.cuadrado?"✅ Balance cuadra":"⚠️ Balance descuadrado"}</td><td class="monto">${clp(bal.activos)}</td></tr>
    </tbody></table>`;

  // FLUJO DE CAJA
  const fcBox = $("contabFC"); if(fcBox) fcBox.innerHTML = `
    <div class="fc-row"><span>💚 Entradas reales</span><span class="monto pos">${clp(fc.entradas)}</span></div>
    <div class="fc-row"><span>🔴 Salidas reales</span><span class="monto neg">(${clp(fc.salidas)})</span></div>
    <div class="fc-row tot"><span><strong>Saldo del mes</strong></span><span class="monto ${fc.saldo>=0?"pos":"neg"}"><strong>${clp(fc.saldo)}</strong></span></div>`;

  // IMPUESTOS
  const impBox = $("contabImp"); if(impBox) impBox.innerHTML = `
    <div class="fc-row"><span>🏷 IVA generado</span><span class="monto">${clp(imp.iva)}</span></div>
    <div class="fc-row"><span>✂️ Retenciones</span><span class="monto">${clp(imp.retenciones)}</span></div>
    <div class="fc-row"><span>🏙 ICA estimado</span><span class="monto">${clp(imp.ica)}</span></div>
    <div class="fc-row tot"><span><strong>Total obligaciones</strong></span><span class="monto neg"><strong>${clp(imp.total)}</strong></span></div>`;

  // CXC/CXP
  const cxcBox = $("contabCxC"); if(cxcBox) {
    cxcBox.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="card-title" style="margin-bottom:10px">📥 Cuentas por Cobrar (${cxc.porCobrar.length})</div>
          ${cxc.porCobrar.slice(0,8).map(c=>`<div class="cxc-row ${c.estado==="Vencida"?"vencida":""}">
            <span>${c.numero||"—"} · ${c.cliente}</span>
            <span class="monto">${clp(c.total)}</span>
            <span class="badge ${c.estado==="Vencida"?"badge-red":"badge-amber"}">${c.estado}</span>
          </div>`).join("")||"<p style='color:var(--text3);font-size:12px;padding:8px'>Sin facturas pendientes</p>"}
        </div>
        <div>
          <div class="card-title" style="margin-bottom:10px">📤 Cuentas por Pagar (${cxc.porPagar.length})</div>
          ${cxc.porPagar.slice(0,8).map(p=>`<div class="cxc-row">
            <span>${p.categoria||"—"} · ${p.proveedor}</span>
            <span class="monto neg">${clp(p.valor)}</span>
          </div>`).join("")||"<p style='color:var(--text3);font-size:12px;padding:8px'>Sin obligaciones pendientes</p>"}
        </div>
      </div>`;
  }

  // RENTABILIDAD POR CLIENTE
  const rentBox = $("contabRent"); if(rentBox) rentBox.innerHTML = `
    <table class="contab-table">
      <thead><tr><th>Cliente</th><th>Ingresos</th><th>Costos</th><th>Utilidad</th><th>Margen</th></tr></thead>
      <tbody>${rent.map(r=>`<tr>
        <td>${r.nombre}</td>
        <td class="monto">${clp(r.ingresos)}</td>
        <td class="monto neg">${clp(r.costos)}</td>
        <td class="monto ${r.utilidad>=0?"pos":"neg"}">${clp(r.utilidad)}</td>
        <td><span class="badge ${r.margen>=30?"badge-teal":r.margen>=10?"badge-amber":"badge-red"}">${r.margen.toFixed(1)}%</span></td>
      </tr>`).join("")||"<tr><td colspan='5' style='text-align:center;color:var(--text3)'>Sin datos</td></tr>"}</tbody>
    </table>`;

  // RIESGO POR CLIENTE
  const riesgoBox = $("contabRiesgo"); if(riesgoBox) riesgoBox.innerHTML = `
    <table class="contab-table">
      <thead><tr><th>Cliente</th><th>Score</th><th>Riesgo</th><th>Mora %</th><th>Días mora</th></tr></thead>
      <tbody>${riesgo.map(r=>`<tr>
        <td>${r.nombre}</td>
        <td><div class="score-bar"><div style="width:${r.score}%;background:${r.score>=80?"var(--green)":r.score>=60?"var(--amber)":"var(--red)"}"></div><span>${r.score}</span></div></td>
        <td><span class="badge ${r.riesgo==="Bajo"?"badge-green":r.riesgo==="Medio"?"badge-amber":r.riesgo==="Alto"?"badge-red":"badge-red"}">${r.riesgo}</span></td>
        <td style="font-size:12px">${r.tasaMora}%</td>
        <td style="font-size:12px">${r.promDias}d</td>
      </tr>`).join("")||"<tr><td colspan='5' style='text-align:center;color:var(--text3)'>Sin datos de riesgo</td></tr>"}</tbody>
    </table>`;

  // FLUJO PREDICTIVO
  renderFlujoPredictivo();

  cont.querySelector("#contabLoading")?.style && (cont.querySelector("#contabLoading").style.display="none");
}

async function renderFlujoPredictivo() {
  const fcBox = $("contabFCPred"); if(!fcBox) return;
  try {
    const data = await proyectarFlujoCaja();
    fcBox.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${data.proyeccion.map(p=>`<div class="fc-pred-card ${p.saldo<0?"riesgo":""}">
          <div class="fc-pred-label">Proyección a ${p.dias} días</div>
          <div class="fc-pred-ent">↑ ${clp(p.entradas)}</div>
          <div class="fc-pred-sal">↓ ${clp(p.salidas)}</div>
          <div class="fc-pred-sal2 ${p.saldo>=0?"pos":"neg"}"><strong>${clp(p.saldo)}</strong></div>
          ${p.saldo<0?'<div class="alerta-riesgo">⚠️ Déficit proyectado</div>':""}
        </div>`).join("")}
      </div>
      <div style="font-size:11px;color:var(--text3)">Basado en promedio histórico de 3 meses. Entradas pendientes: ${clp(data.pendientesCobro)}</div>`;
  } catch(e) { fcBox.innerHTML = "<p style='color:var(--text3)'>Datos insuficientes para proyección</p>"; }
}

export async function renderSimulador() {
  const pctIng  = Number($("simIngreso")?.value||0);
  const pctGto  = Number($("simGasto")?.value||0);
  const pctCto  = Number($("simCosto")?.value||0);
  const nPers   = Number($("simPersonal")?.value||0);
  const res = await simularEscenario({ pctIngreso:pctIng, pctGasto:pctGto, pctCosto:pctCto, nuevoPersonal:nPers });
  const box = $("simResultado"); if(!box) return;
  const fila = (lbl, base, nuevo, delta) =>
    `<tr><td>${lbl}</td><td class="monto">${clp(Math.round(base))}</td><td class="monto">${clp(Math.round(nuevo))}</td><td class="monto ${delta>=0?"pos":"neg"}">${delta>=0?"+":""}${clp(Math.round(delta))}</td></tr>`;
  box.innerHTML = `
    <table class="contab-table">
      <thead><tr><th>Indicador</th><th>Actual</th><th>Proyectado</th><th>Δ Cambio</th></tr></thead>
      <tbody>
        ${fila("Ingresos",res.base.ingresos,res.nuevo.ingresos,res.delta.ingresos)}
        ${fila("Gastos totales",res.base.gastos,res.nuevo.gastos,res.delta.gastos)}
        ${fila("Utilidad neta",res.base.utilidadNeta,res.nuevo.utilidadNeta,res.delta.utilidad)}
        ${fila("Flujo de caja",res.base.flujoCaja,res.nuevo.flujoCaja,res.delta.flujoCaja)}
      </tbody>
    </table>
    <div style="margin-top:12px;padding:12px;border-radius:10px;background:${res.riesgo==="Alto"?"rgba(239,68,68,.1)":res.riesgo==="Medio"?"rgba(245,158,11,.1)":"rgba(16,185,129,.1)"};border:1px solid ${res.riesgo==="Alto"?"rgba(239,68,68,.2)":res.riesgo==="Medio"?"rgba(245,158,11,.2)":"rgba(16,185,129,.2)"}">
      Nivel de riesgo del escenario: <strong style="color:${res.riesgo==="Alto"?"var(--red)":res.riesgo==="Medio"?"var(--amber)":"var(--green)"}">${res.riesgo}</strong>
    </div>`;
}

export async function renderPreCierre() {
  const mes = $("mesContab")?.value || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const tareas = await verificarPreCierre(mes);
  const box = $("preCierreList"); if(!box) return;
  box.innerHTML = tareas.map(t=>`
    <div class="tarea-cierre ${t.ok?"ok":"pendiente"}">
      <span>${t.ok?"✅":"⏳"}</span>
      <span>${t.msg}</span>
    </div>`).join("");
}

export async function renderLibroDiario() {
  const box = document.querySelector("#tablaLibroDiario tbody"); if(!box||!_empId) return;
  box.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3)">Cargando...</td></tr>';
  const snap = await getDocs(
    query(collection(db,"empresas",_empId,"libroDiario"), orderBy("fecha","desc"), limit(50))
  );
  if(!snap.size) { box.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">Sin asientos registrados</td></tr>'; return; }
  box.innerHTML = snap.docs.map(d=>{
    const a=d.data();
    const debitos  = (a.lineas||[]).filter(l=>l.tipo==="debito").reduce((s,l)=>s+Number(l.valor||0),0);
    const creditos = (a.lineas||[]).filter(l=>l.tipo==="credito").reduce((s,l)=>s+Number(l.valor||0),0);
    return `<tr>
      <td style="font-size:11px;color:var(--text2)">${a.fecha?fmt(a.fecha.toDate()):"—"}</td>
      <td><span class="badge ${a.manual?"badge-amber":"badge-teal"}" style="font-size:9px">${a.tipo||"manual"}</span></td>
      <td style="font-size:12px">${a.descripcion||"—"}<br><span style="font-size:10px;color:var(--text3)">${a.tercero||""}</span></td>
      <td class="monto">${clp(debitos)}</td>
      <td class="monto">${clp(creditos)}</td>
    </tr>`;
  }).join("");
}
