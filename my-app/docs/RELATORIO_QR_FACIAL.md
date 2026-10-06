# Relatório: correção de leitura QR e diagnóstico facial

## Resultado

O scanner QR agora tem um decoder isolado e testável, usa fallback para `jsqr` quando o detector nativo falha, reduz a imagem processada e tenta uma região central. O parser lida com payloads comuns de etiquetas sem correspondência por substring e sem colisão silenciosa entre códigos próximos. A tela de checklist diferencia falha de leitura de item não reconhecido e oferece entrada manual também durante a leitura.

O cadastro facial agora valida embeddings antes da comparação local e expõe diagnósticos agregados em `?debug=1`. Os dados diagnósticos de consistência permanecem visíveis mesmo quando a API retorna erro. A política de câmera foi aplicada somente às duas áreas que usam câmera. Foi criado um gerador offline de etiquetas de demonstração para os dez produtos, sem acesso ao banco.

## Arquivos principais

| Área | Arquivos |
|---|---|
| QR: parsing e correspondência | `lib/qr/parseEtiqueta.ts`, `lib/qr/localizarItem.ts` e respectivos testes |
| QR: leitura, câmera e UI | `lib/qr/decoder.ts`, `lib/qr/decoder.test.ts`, `app/components/ProductEtiquetaScanner.tsx`, `app/almoxarifado/requisicoes/[numeroPedido]/page.tsx` |
| Facial | `lib/facial/config.ts`, `lib/face.ts`, `lib/face.test.ts`, `app/api/admin/face-enrollment/route.ts`, `app/admin/biometria/FaceEnrollmentManager.tsx` |
| Material demo e política da câmera | `scripts/gerar-qr-demo.ts`, `public/qr-demo.html`, `package.json`, `next.config.ts` |
| Diagnóstico | `docs/DIAGNOSTICO_QR_FACIAL.md` |

## Validações

- `npx tsc --noEmit`: passou.
- `npm run lint`: passou.
- `npm test -- --run`: passou, 296 testes em 65 arquivos; a suíte padrão exclui `tests/integration-tidb.test.ts`.
- `npx vitest run lib/qr/decoder.test.ts`: passou, 6 testes.
- `npm run qr:demo`: passou; HTML contém 10 etiquetas QR inline.
- `git diff --check`: passou.
- Build isolado: `next build --webpack` compilou e concluiu TypeScript, mas a etapa de coleta de rotas falhou porque `DATABASE_URL` não está configurada. O build padrão Turbopack na cópia isolada recusou o junction externo de `node_modules`. Não foi criado valor fictício para `DATABASE_URL`, pois não se deve conectar a banco neste trabalho. O build completo, portanto, não está validado.

## Limites e próximos testes manuais

1. Abrir `/almoxarifado/requisicoes/<pedido>` em dispositivo com câmera e ler QR de produto. Confirmar que a câmera identifica o código; se não identificar, usar entrada manual no próprio modal.
2. Abrir `public/qr-demo.html`, selecionar cada produto e confirmar código/nome; imprimir e testar os QR com o mesmo dispositivo usado no checklist.
3. Em `/admin/biometria?debug=1`, testar carregamento do modelo, permissão/ausência da câmera e capturas em iluminação adequada. Verificar que diagnósticos de consistência persistem após uma resposta de erro da API.
4. Testar em um dispositivo/browser que tenha `BarcodeDetector` e outro sem ele; confirmar o fallback para `jsqr` após falha do detector nativo.

Não foi acessado banco nem serviço facial externo. Não foram executados seed, reset ou migrations. A divergência facial observada anteriormente pode vir do fornecedor externo ou da comparação local; sem telemetria/resposta do fornecedor, sua origem em produção permanece indeterminada. O limiar de reconhecimento de login não foi alterado e ainda requer calibração FAR/FRR do fornecedor.
