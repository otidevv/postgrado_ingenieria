import { NextResponse } from "next/server";

// Proxy de la consulta por DNI a la API institucional de la UNAMAD.
// Se hace del lado del servidor para evitar CORS y normalizar la respuesta
// a los campos que usa el formulario de postulación.
const UPSTREAM = "https://apidatos.unamad.edu.pe/api/consulta";

type UpstreamDni = {
  DNI?: string;
  AP_PAT?: string;
  AP_MAT?: string;
  NOMBRES?: string;
  FECHA_NAC?: string;
  DIRECCION?: string;
  SEXO?: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dni: string }> },
) {
  const { dni } = await params;
  if (!/^\d{8}$/.test(dni)) {
    return NextResponse.json({ error: "DNI inválido." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${UPSTREAM}/${dni}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: "No se encontraron datos para ese DNI." },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const d = (await res.json()) as UpstreamDni;
    const firstName = (d.NOMBRES ?? "").trim();
    const lastName = [d.AP_PAT, d.AP_MAT]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(d.FECHA_NAC ?? "")
      ? (d.FECHA_NAC as string)
      : "";
    const gender = d.SEXO === "1" ? "M" : d.SEXO === "2" ? "F" : "";
    const address = (d.DIRECCION ?? "").trim();

    if (!firstName && !lastName) {
      return NextResponse.json(
        { error: "No se encontraron datos para ese DNI." },
        { status: 404 },
      );
    }

    return NextResponse.json({ firstName, lastName, birthDate, gender, address });
  } catch {
    return NextResponse.json(
      { error: "El servicio de consulta no está disponible por ahora." },
      { status: 504 },
    );
  }
}
