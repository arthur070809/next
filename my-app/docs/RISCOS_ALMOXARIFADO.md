# Riscos e limites residuais

Nenhuma destas verificações acessou banco ou serviço externo.

1. **Excedentes não são saldo físico de sobra.** O cálculo usa requisições concluídas com motivo `EXCEDEU_LOTE_MINIMO`, quantidade de saída e setor dos metadados. Isso mede o excedente entregue, não prova devolução, localização física ou disponibilidade para reaproveitamento. Para controlar sobra real será necessário registrar recebimento/devolução, quantidade, condição, local e responsável em uma operação persistida; schema e API correspondentes não foram adicionados.
2. **Descrição do catálogo.** O schema não fornece descrição própria para `Item`; usa-se `categoria` como informação de catálogo e `RequisicaoItem.descricao` como texto da requisição. Não foi inventada uma nova coluna.
3. **Facial.** O serviço de embeddings é externo. Sem documentação/telemetria do fornecedor e conjunto de avaliação não há evidência para ajustar FAR/FRR ou confirmar a equivalência completa entre seu pipeline e o detector local de qualidade. Nenhum limiar de reconhecimento de login foi afrouxado.
4. **Foto única no cadastro.** Não implementada por incompatibilidade com o contrato de persistência atual e risco de contornar consistência/qualidade ou enviar imagem da galeria pelo caminho existente. Para implementá-la com segurança, primeiro é necessário contrato do fornecedor para extração local compatível e persistência somente de descritor, com avaliação de qualidade/recadastro.
5. **QR e permissões de câmera.** Os testes simulam decoder e ciclo de vida de tracks; não verificam permissões, foco, câmera, navegador integrado ou impressão em hardware real.
6. **Layout.** Os tamanhos móveis e desktop foram avaliados por leitura estática de classes e CSS, não por browser/aparelho. Rolagem interna, sticky, teclado virtual, contraste e targets devem ser confirmados visualmente.
7. **Banco e build.** O build isolado não deve receber URL fictícia nem acessar o banco. A coleta de rotas pode exigir configuração de `DATABASE_URL`; resultado e etapa exatos constam no relatório final.
8. **Branch.** A branch local não foi sincronizada; os commits remotos/atrasados não foram incorporados.
