export function inspectFaceCount<T>(faces: readonly T[]) {
  if (faces.length === 0) {
    return { face: null, message: "Nenhum rosto detectado. Posicione o rosto na oval" };
  }
  if (faces.length > 1) {
    return { face: null, message: "Mais de um rosto na câmera" };
  }
  return { face: faces[0], message: null };
}
