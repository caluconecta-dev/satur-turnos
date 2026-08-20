const { getStore } = require("@netlify/blobs");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORARIO_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_LEN = 200;

function store() {
  return getStore("turnos-satur");
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function clean(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_LEN) : "";
}

async function handleGet(event) {
  const fecha = clean(event.queryStringParameters && event.queryStringParameters.fecha);
  if (!FECHA_RE.test(fecha)) {
    return jsonResponse(400, { error: "Parámetro 'fecha' inválido (usar YYYY-MM-DD)." });
  }

  const bookings = (await store().get(fecha, { type: "json" })) || [];
  const ocupados = bookings.map((b) => ({ horario: b.horario, estilista: b.estilista }));
  return jsonResponse(200, { ocupados });
}

async function handlePost(event) {
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (err) {
    return jsonResponse(400, { error: "JSON inválido." });
  }

  const fecha = clean(data.fecha);
  const horario = clean(data.horario);
  const estilista = clean(data.estilista) || "general";
  const nombre = clean(data.nombre);
  const telefono = clean(data.telefono);
  const servicio = clean(data.servicio);
  const comentario = clean(data.comentario);

  if (!FECHA_RE.test(fecha)) return jsonResponse(400, { error: "Fecha inválida." });
  if (!HORARIO_RE.test(horario)) return jsonResponse(400, { error: "Horario inválido." });
  if (!nombre || !telefono || !servicio) {
    return jsonResponse(400, { error: "Faltan datos obligatorios (nombre, teléfono o servicio)." });
  }

  const s = store();
  const bookings = (await s.get(fecha, { type: "json" })) || [];

  const yaOcupado = bookings.some(
    (b) => b.horario === horario && b.estilista === estilista
  );
  if (yaOcupado) {
    return jsonResponse(409, { error: "Ese horario ya fue reservado. Elegí otro." });
  }

  bookings.push({
    horario,
    estilista,
    nombre,
    telefono,
    servicio,
    comentario,
    creadoEn: new Date().toISOString()
  });

  await s.setJSON(fecha, bookings);

  return jsonResponse(200, { ok: true });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") return await handleGet(event);
    if (event.httpMethod === "POST") return await handlePost(event);
    return jsonResponse(405, { error: "Método no permitido." });
  } catch (err) {
    return jsonResponse(500, { error: "Error interno." });
  }
};
