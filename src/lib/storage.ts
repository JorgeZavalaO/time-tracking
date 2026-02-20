import { put } from "@vercel/blob"

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error("Formato de selfie inválido. Se esperaba data URL base64")
  }

  const mimeType = match[1]
  const base64 = match[2]
  const buffer = Buffer.from(base64, "base64")

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"
  return { buffer, mimeType, ext }
}

export async function uploadSelfieFromDataUrl(args: {
  dataUrl: string
  collaboratorId: number
  timestamp?: Date
}): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    // en local/dev permitimos continuar sin bloquear la marcación
    return null
  }

  const { buffer, mimeType, ext } = dataUrlToBuffer(args.dataUrl)
  const date = (args.timestamp ?? new Date()).toISOString().replace(/[:.]/g, "-")
  const pathname = `access-selfies/collaborator-${args.collaboratorId}/${date}.${ext}`

  const uploaded = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    token,
    addRandomSuffix: true,
  })

  return uploaded.url
}
