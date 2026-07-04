import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las postulaciones suben documentos (DNI, grado, CV) por Server Action.
    // El límite por defecto de body de un Server Action es 1MB; lo subimos
    // para admitir varios archivos. Cada archivo se valida a ≤5MB en el server.
    serverActions: {
      bodySizeLimit: "25mb",
    },
    // El proxy (middleware) bufferea el body hasta 10MB por defecto; lo
    // ampliamos para que no trunque los envíos con adjuntos.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
