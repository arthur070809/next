# Diagnóstico inicial: QR e reconhecimento facial

> Nota de atualização: as observações abaixo registram o estado anterior à implementação local descrita em `README.md`. O código atual usa MobileFace no navegador, modelos locais em `public/models/human/` e comparação server-side; não depende de `FACE_SERVICE_URL` nem de endpoints externos `/v1/*`.

## Escopo e restrições

Leitura estática da branch `feat/inventario-invisivel`; nenhum banco ou arquivo `.env*` foi aberto. Nenhum seed, reset ou migration foi executado. O estado inicial do worktree estava limpo no commit `273b768`.

## QR — achados antes das correções desta revisão

- O scanner usa `BarcodeDetector` nativo quando a feature existe e anuncia `qr_code`; caso contrário carrega `jsqr` dinamicamente. `jsqr` já é dependência de runtime (`package.json`, versão declarada `^1.4.0`); não há `html5-qrcode`, `@zxing/*`, WASM ou worker identificado. A biblioteca carrega apenas quando o scanner é montado.
- O código de seleção do decoder está em `app/components/ProductEtiquetaScanner.tsx` (inicialização e fallback) e o loop usa `requestAnimationFrame`. O loop aguarda `readyState >= HAVE_CURRENT_DATA`, limita a 10 leituras/s, pede câmera traseira com 1920×1080 e reduz a imagem do fallback para no máximo 1280 px no maior eixo.
- **Defeito reproduzível por inspeção:** se `BarcodeDetector` existir, mas `getSupportedFormats` ou o construtor/detector falhar, o erro chega ao `catch` externo de inicialização e encerra o scanner; o fallback `jsqr` só é carregado quando não se criou um detector. Uma falha no detector nativo durante `detect()` também não tenta jsqr.
- Não existe scanner desacoplado/testável. Não há callback de vídeo pronto alternativo, recorte central, nem painel de diagnóstico; o `catch` de cada frame substitui o estado com mensagem genérica. A resposta “leu mas não casou” não é mostrada como estado distinto do erro genérico da tela.
- `lib/qr/parseEtiqueta.ts` aceita somente dígitos puros (1–8), ainda que trate espaços e alguns caracteres invisíveis. URL, JSON e pares chave/valor são rejeitados.
- `lib/qr/localizarItem.ts` compara código normalizado por igualdade e não por substring, portanto `1794` e `17940` não se confundem. Entretanto, dois códigos que se tornem iguais após remover zeros à esquerda não são tratados como ambíguos.
- A página de checklist mantém entrada manual fora do modal do scanner, mas ela fica coberta enquanto o modal está aberto. A leitura chama `parseEtiqueta` antes do endpoint; o texto original não é exibido em caso de formato inválido.
- Há um script anterior `scripts/gerar-qr-etiqueta.ts`, porém ele consulta o banco e não serve para gerar material de teste offline. Não há `public/qr-demo.html` nem `lib/qr/decoder.ts` no histórico examinado.
- `lib/qr/camera-utils.ts` já trata erros de permissão, ausência/uso da câmera e contexto inseguro, interrompe todas as tracks e pede `playsInline` no vídeo. O efeito do scanner usa um ref compartilhado como flag de atividade; uma montagem/desmontagem rápida (React StrictMode) pode tornar ambígua a propriedade da stream.

## Facial — achados antes das correções desta revisão

- A frase “As capturas ficaram diferentes. Tente novamente.” tem **duas origens possíveis**: o serviço externo pode retornar `INCONSISTENT_SAMPLES` em `lib/face.ts`, ou a API pode produzir a mesma mensagem quando `areEnrollmentEmbeddingsConsistent()` reprova em `app/api/admin/face-enrollment/route.ts`.
- A comparação local mede distância euclidiana entre cada embedding e o embedding da primeira captura, exigindo `<= 0.35`. Não valida finitude, dimensão comum ou norma antes de comparar. Essa hipótese é confirmada como comportamento local; a origem do erro reportado em produção não pode ser decidida sem distinguir a resposta externa da rejeição local.
- O limiar de correspondência de login (`FACE_MATCH_THRESHOLD`, default `0.42`) é passado ao serviço externo em `lib/face.ts`; `README.md` o descreve como ponto de partida que precisa de medição FAR/FRR pelo fornecedor. O comparador/modelo de enrollment e login é externo ao repositório. Não há uma recomendação verificável de limiar da biblioteca `@vladmandic/human` para essa comparação, pois essa biblioteca é usada no navegador para detecção/mesh e não gera os embeddings persistidos.
- O cadastro captura frente, giros laterais e piscar; há controles locais de luz, nitidez, posição, tamanho relativo e movimento. A coleta usa `video.play()`, `getUserMedia`, canvas e encerra tracks ao parar/desmontar. O fallback para CPU instancia `Human` com configuração reduzida, diferente da configuração WebGL.
- A biblioteca e pesos Human são carregados de `cdn.jsdelivr.net` por `new Function(... import(url))`. Não há arquivos de modelo em `public/`. Essa carga é iniciada somente na tela de cadastro, mas falhas dos modelos resultam em um estado de erro genérico.
- Os templates são serializados como JSON de `number[]`, cifrados com AES-256-GCM e decifrados do banco; a leitura valida que os elementos são números finitos, mas não há teste de round-trip/dimensão/norma no projeto.
- O login real valida o desafio no servidor e falha fechado; o resultado do browser não cria sessão. Não há mudança planejada no login, allowlist demo ou limiar de correspondência.

## Headers e deploy

- Na inspeção inicial, `next.config.ts` continha somente a opção experimental `authInterrupts`; nesta revisão foram adicionados headers de câmera apenas às rotas que efetivamente usam a câmera.
- Não foi encontrado `middleware.ts`/`middleware.js` nem `vercel.json` no app. Portanto, não há política de câmera/CSP customizada no repositório para confirmar como aplicada pela Vercel.
- O módulo Human e os modelos são solicitados a jsDelivr. Como não existe CSP local explícita, não se identificou bloqueio por uma CSP definida neste repositório; a política final de borda da hospedagem permanece não verificada.

## Hipóteses iniciais

| Hipótese | Resultado inicial | Evidência |
|---|---|---|
| QR H1: ausência de fallback | Descartada parcialmente | Existe fallback `jsqr`, mas não cobre erros do detector nativo |
| QR H2: leitura antes do vídeo pronto / loop encerrado | Parcialmente descartada | O loop verifica `readyState` e segue via rAF; exceção nativa encerra a inicialização |
| QR H3: atributos iOS / StrictMode | Parcialmente descartada | `muted`, `playsInline`, `play()` e cleanup existem; flag compartilhada pode conflitar em remount |
| QR H4: wasm/worker/CDN bloqueado | Descartada para QR | `jsqr` puro, sem WASM/worker; nenhum CDN de decoder |
| QR H5/H6: resolução/foco/frame | Parcialmente confirmada | Resolução alta e foco tentado; fallback não reduz a 640–960 nem tenta ROI |
| QR H7: parser rejeita payload válido | Confirmada | Parser só aceita código numérico puro |
| QR H8: colisão de códigos | Parcialmente descartada | Igualdade exata após normalização; colisão após remover zeros não é tratada |
| Facial F1: consistência estrita | Confirmada no caminho local; produção inconclusiva | Distância à primeira amostra deve ser <= 0.35; serviço externo também pode emitir a mensagem |
| Facial F2: modelos incompletos | Parcialmente confirmada como risco | Carga CDN e fallback com configuração distinta; estado só registra pronto/erro |
| Facial F3: pipeline inconsistente | Confirmada como risco | Capturas são por estágios guiados; enrollment e verificação pertencem ao serviço externo |
| Facial F4: qualidade de captura | Parcialmente descartada | Há gates de luz/nitidez/rosto/posição, sem métricas ou diagnósticos visíveis |
| Facial F5: serialização | Inconclusiva | JSON + AES-GCM é usado, mas falta teste de round-trip |
| Facial F6/F7/F8 | Inconclusivas | Não há evidência local suficiente para avaliar mistura do serviço, vivacidade ou contrato remoto |

Este arquivo será atualizado com correções, testes, validações e limites de verificação no relatório final.

## Correções implementadas e validação

- O decoder QR foi extraído para `lib/qr/decoder.ts`: mantém `BarcodeDetector` quando funciona, troca para `jsqr` se a inicialização ou a leitura nativa falhar, reduz os quadros para até 800 px, tenta um recorte central periódico e permite parar/cancelar o loop. `lib/qr/decoder.test.ts` testa round-trip de códigos reais, quadro vazio, vídeo ainda não pronto, cancelamento e fallback após erro do detector nativo.
- `lib/qr/parseEtiqueta.ts` agora aceita código puro, URL, JSON, chave/valor e texto com código, normalizando Unicode/espaços sem aceitar payloads ambíguos. `lib/qr/localizarItem.ts` continua usando igualdade exata e recusa códigos que colidem após normalização.
- O scanner mostra o texto reconhecido e o resultado do parser em `?debug=1`; permite entrada manual dentro do modal e apresenta estados separados para QR ilegível e QR reconhecido que não corresponde a item.
- O cadastro facial centraliza limiares do comparador local, valida dimensões/valores/norma dos embeddings e descarta no máximo um outlier quando restam pelo menos três capturas consistentes. A API retorna apenas métricas agregadas, sem imagens ou descritores. O painel `?debug=1` apresenta estado de modelo/câmera, backend, tempo, score de detecção, tamanho relativo do rosto, luz, nitidez e as métricas de consistência sem sobrescrevê-las com o código de erro.
- A detecção facial usa `boxScore` e `boxRaw` (normalizado) fornecidos pelo Human, em vez do score global e de uma divisão adicional pela resolução do vídeo.
- `scripts/gerar-qr-demo.ts` gera `public/qr-demo.html` offline com dez produtos, SVGs embutidos, seleção por código e impressão. Não consulta o banco nem carrega recursos externos.
- `next.config.ts` restringe `Permissions-Policy: camera=(self)` às rotas de checklist, estoque e cadastro facial. `next.config.test.ts` confere a lista.
- A suíte padrão desta revisão passou com 358 testes em 80 arquivos. `npx tsc --noEmit` e `npm run lint` passaram. Os testes QR cobrem os dez códigos atuais e a estrutura standalone/print das etiquetas.
- O build isolado foi compilado e passou a verificação TypeScript usando `next build --webpack`, mas falhou ao coletar dados de rotas porque `lib/prisma.ts` exige `DATABASE_URL`. Não foi fornecida URL fictícia nem tentada conexão. A cópia temporária excluiu `.env*` e foi removida. Portanto, o build de produção completo permanece bloqueado pela restrição de não configurar/conectar banco.
- A página QR foi validada estruturalmente (10 etiquetas SVG embutidas e filtro de produto); não foi impressa nem testada com câmera física. A origem exata de divergência facial em produção continua inconclusiva sem resposta/telemetria do serviço facial externo; calibração FAR/FRR também depende do fornecedor.
