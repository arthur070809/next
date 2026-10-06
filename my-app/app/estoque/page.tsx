"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./stock-list.module.css";
import { MAX_STOCK_BALANCE, MAX_STOCK_INPUT, STOCK_UNITS, StockUnit } from "@/lib/stock-units";
import { isAtOrBelowReorderPoint } from "@/lib/stock-status";

type EstoqueItem = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  pontoPedido: number;
  quantidadeDeposito: number;
  tipoUnidade: StockUnit | null;
  quantidadePorEmbalagem: number | null;
  ultimaEntradaEmbalagens: number | null;
};

const initialForm = {
  nome: "",
  categoria: "",
  tipoUnidade: "unidade" as StockUnit | "",
  quantidadePorEmbalagem: "1",
  quantidadeEmbalagens: "",
};

type QuantityField = "quantidadePorEmbalagem" | "quantidadeEmbalagens";
type QuantityErrors = Partial<Record<QuantityField, string>>;

const catalogo = {
  Parafusos: ["Parafuso Sextavado (Aço Carbono / Inox)", "Parafuso Allen (Cabeça Cilíndrica)", "Parafuso Allen (Cabeça Chata / Escareada)", "Parafuso Allen sem Cabeça (Sextavado Interno)", "Parafuso Auto-Brocante / Auto-Perfurante", "Parafuso Cabeça Panela (Philips / Fenda)", "Parafuso Francês", "Parafuso Prisioneiro / Haste Roscada"],
  Porcas: ["Porca Sextavada Comum", "Porca Autofrenante (com Nylon)", "Porca Borboleta", "Porca Gaiola", "Porca Dupla / Alta", "Porca de Solda"],
  Arruelas: ["Arruela Lisa (Aço / Inox)", "Arruela de Pressão", "Arruela Dentada (Externa / Interna)", "Arruela Funileiro (Aba Larga)", "Arruela de Vedação (Neoprene / Borracha)"],
  "Elementos de Fixação Direta": ["Rebite de Repuxo (POP - Alumínio / Aço)", "Rebite Maciço de Aço", "Anel Elástico Externo (para Eixo)", "Anel Elástico Interno (para Furo)", "Inserto Roscado (Postiço)", "Bucha de Expansão / Ancoragem"],
  "Travamento e Alinhamento": ["Pino Elástico (Pino Trava)", "Pino Cilíndrico / Guia", "Contrapino (Cavilha / Contrapino de Pressão)", "Chaveta Paralela", "Chaveta Meia-Lua (Woodruff)"],
  "Vedações e Anéis": ["Anel O-Ring (Nitrílica / Viton)", "Retentor de Óleo e Graxa", "Gaxeta Hidráulica / Pneumática", "Raspador de Haste", "Fita de Vedação (Teflon)"],
  "Abraçadeiras e Conexões": ["Abraçadeira Rosca Sem Fim", "Abraçadeira de Alta Pressão (Tucho)", "Abraçadeira Tipo D / U", "Abraçadeira de Nylon (Enforca-Gato)", "Conexão Rápida Pneumática (Engate Rápido)"],
  Molas: ["Mola de Compressão", "Mola de Tração", "Mola de Torção", "Mola Prato (Belleville)"],
  "Rodízios e Pés": ["Rodízio Fixo (Nylon / Poliuretano / Borracha)", "Rodízio Giratório com Travão", "Rodízio Giratório sem Travão", "Pé Nivelador Articulado", "Batente de Borracha / Amortecedor"],
  "Insumos de Solda": ["Arame MIG/MAG (Carretel)", "Elétrodo Revestido (AWS E6013 / E7018)", "Vareta TIG (Aço Carbono / Inox)", "Bico de Contacto MIG", "Bocal de Solda", "Difusor de Gás"],
  "Ferramentas de Corte e Abrasivos": ["Disco de Corte para Metal", "Disco de Desbaste", "Disco Flap (Lixa)", "Broca Helicoidal (Aço Rápido)", "Macho para Roscagem (Manual / Máquina)", "Fresa de Metal Duro / Inserto Intercambiável", "Lâmina de Serra de Fita"],
  "Cabos e Correntes": ["Cabo de Aço Galvanizado", "Clips / Prensa-Cabo de Aço", "Sapatilha para Cabo de Aço", "Esticador de Cabo de Aço", "Corrente Industrial de Elo", "Manilha de Carga / Mosquetão"],
  "Componentes Mecânicos Industriais": ["Rolamento de Esferas", "Rolamento de Roletes", "Bucha de Bronze / Autolubrificante", "Bico Graxeiro (Reto / 45° / 90°)", "Manípulo de Aperto (Estrela / Tê)", "Fecho / Trava de Pressão"],
  "Química e Lubrificantes Industriais": ["Trava Química Anaeróbica (Fixador de Rosca)", "Silicone Industrial / Veda-Junta", "Desengripante / Antiferrugem em Spray", "Óleo Solúvel / Fluído de Corte", "Cola Epóxi / Adesivo Estrutural", "Tinta Spray para Retoque"],
  "Material Elétrico Industrial": ["Terminal Pré-Isolado (Olhal / Garfo / Ilhó)", "Conetor Rápido de Torção / Encaixe", "Espaguete Termorretrátil", "Fita Isolante Industrial", "Prensa-Cabo Elétrico (NPT / PG)"],
  "Engrenagens e Transmissão Mecânica": ["Corrente de Transmissão (Asa / Din)", "Engrenagem para Corrente (Pinhão / Eixo)", "Polia em V (Alumínio / Ferro Fundido)", "Correia em V (Perfil A, B, C)", "Correia Dentada / Sincronizadora", "Acoplamento Flexível de Alinhamento"],
  "Tubos, Mangueiras e Conexões Hidráulicas": ["Mangueira Hidráulica de Alta Pressão (Trama de Aço)", "Conexão Prensada / Reutilizável", "Adaptador Hidráulico (NPT, BSP, JIC)", "Tubo de Cobre / Alumínio / Inox para Linhas", "Válvula de Esfera / Retenção Hidráulica", "Manômetro de Pressão (Seco / Glicerina)"],
  "Mangueiras e Tubos Pneumáticos": ["Tubo de Poliuretano (PU - 4mm, 6mm, 8mm, 10mm, 12mm)", "Tubo de Nylon (PA)", "Mangueira Espiral / Espiralada para Ar", "Silenciador Pneumático para Válvulas", "Válvula Solenóide Pneumática", "Bloco Distribuidor Manifold"],
  "Proteção de Cabos e Organização Elétrica": ["Conduíte / Esponjoso / Tubo Corrugado", "Esteira Porta-Cabos (Calha Articulada)", "Canaleta de PVC Perfurada para Painel", "Prensa-Cabo de Latão Niquelado", "Organizador de Cabos (Espiral / Helawrap)", "Trilho DIN para Fixação de Componentes"],
  "Elementos de Fixação de Tubos e Painéis": ["Abraçadeira Leve para Tubos (Cunha / Unistrut)", "Presilha de Fixação de Painéis", "Porca Gaiola para Rack / Painel", "Passa-Cabo de Borracha (Grommet)", "Grampo U de Fixação de Tubos"],
  "Instrumentação e Medição de Estoque": ["Paquímetro (Manual / Digital)", "Micrômetro Externo", "Relógio Comparador / Apalpador", "Trena Metálica Industrial", "Calibre de Folga / Calibre de Raio", "Esquadro de Precisão para Ajustagem"],
  "Limpeza, Desengraxe e Organização de Oficina": ["Estopa de Limpeza / Pano Industrial", "Desengraxante Industrial Concentrado", "Absorvente Granulado para Óleo / Derramamento", "Tapete Ergonômico Antifadiga", "Saco de Lixo Heavy Duty / Industrial", "Pincel e Escova para Limpeza de Peças"],
  "Solda - Acessórios de Proteção e Consumíveis Especiais": ["Antirespingo de Solda (Com / Sem Silicone)", "Giz de Cera Térmico / Giz de Caldeiraria", "Lente de Proteção para Máscara de Solda (Incolor / Escura)", "Anel O-ring para Tocha TIG", "Eletrodo de Tungstênio (Ponta Verde / Vermelha / Cinza)", "Escova de Aço com Cabo de Madeira para Solda"],
  "Equipamentos de Ajustagem e Acabamento Manual": ["Lima Bastarda (Chata, Redonda, Meia-Cana, Triangular)", "Lima Mussa (Acabamento)", "Rasquete / Rebarbador Manual de Tubos", "Pedra de Afiar / Brunir", "Pasta de Esmerilhar Válvulas / Polimento", "Palha de Aço / Fibra Abrasiva Industrial"],
  "Elementos de Articulação e Movimentação Linear": ["Rótula Esférica (Terminal Rotular KSM/POS)", "Eixo Guiado Retificado e Cromado", "Anel de Encosto / Trava para Eixo", "Bloco Deslizante / Pistonete Guia", "Patim e Guia Linear para Precisão"],
} as const;

const categorias = Object.keys(catalogo);

export default function EstoquePage() {
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busca, setBusca] = useState("");
  const [categoriaBusca, setCategoriaBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [errosQuantidade, setErrosQuantidade] = useState<QuantityErrors>({});
  const [erroLista, setErroLista] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [nomeAberto, setNomeAberto] = useState(false);
  const salvandoRef = useRef(false);
  const listaRef = useRef<HTMLDivElement>(null);

  const materiaisDaCategoria = form.categoria
    ? catalogo[form.categoria as keyof typeof catalogo] ?? []
    : [];

  const materiaisSugeridos = materiaisDaCategoria.filter((material) =>
    material.toLowerCase().includes(form.nome.toLowerCase())
  );

  const carregarItens = async () => {
    try {
      const response = await fetch("/api/estoque", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setErroLista(data.error ?? "Não foi possível carregar o estoque.");
        return;
      }
      setErroLista("");
      setItens(data.itens ?? []);
    } catch {
      setErroLista("Não foi possível comunicar com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let ativo = true;
    fetch("/api/estoque", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar o estoque.");
        return data.itens ?? [];
      })
      .then((itensCarregados) => {
        if (!ativo) return;
        setErroLista("");
        setItens(itensCarregados);
      })
      .catch((cause) => {
        if (ativo) setErroLista(cause instanceof Error ? cause.message : "Não foi possível comunicar com o servidor.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: 0 });
  }, [busca, categoriaBusca]);

  const itensFiltrados = useMemo(
    () => itens.filter((item) => {
      const correspondeBusca = `${item.nome} ${item.categoria}`.toLowerCase().includes(busca.toLowerCase());
      const correspondeCategoria = !categoriaBusca || item.categoria === categoriaBusca;
      return correspondeBusca && correspondeCategoria;
    }),
    [itens, busca, categoriaBusca]
  );

  const cadastrarItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (salvandoRef.current) return;
    setErro("");
    setErrosQuantidade({});
    setMensagem("");

    try {
      if (!form.categoria) {
        setErro("Selecione uma categoria.");
        return;
      }
      if (!materiaisDaCategoria.includes(form.nome as never)) {
        setErro("Selecione uma categoria e um material disponível nessa categoria.");
        return;
      }
      const unidadeSelecionada = STOCK_UNITS.find((unit) => unit.value === form.tipoUnidade);
      if (!unidadeSelecionada) {
        setErro("Selecione o tipo de unidade.");
        return;
      }

      const quantidadeValida = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_STOCK_INPUT;
      const limite = MAX_STOCK_INPUT.toLocaleString("pt-BR");
      const novosErros: QuantityErrors = {};
      if (form.tipoUnidade !== "unidade" && !quantidadeValida(form.quantidadePorEmbalagem)) {
        novosErros.quantidadePorEmbalagem = `Informe a quantidade por ${unidadeSelecionada.singular} como inteiro positivo (máximo: ${limite}).`;
      }
      if (!quantidadeValida(form.quantidadeEmbalagens)) {
        novosErros.quantidadeEmbalagens = `Informe a quantidade de ${unidadeSelecionada.countLabel} como inteiro positivo (máximo: ${limite}).`;
      }
      if (Object.keys(novosErros).length > 0) {
        setErrosQuantidade(novosErros);
        return;
      }

      const quantidadeEmbalagens = Number(form.quantidadeEmbalagens);
      const quantidadePorEmbalagem = form.tipoUnidade === "unidade" ? 1 : Number(form.quantidadePorEmbalagem);
      const total = quantidadeEmbalagens * quantidadePorEmbalagem;
      if (!Number.isSafeInteger(total) || total > MAX_STOCK_BALANCE) {
        setErro("O saldo calculado excede o limite permitido para o estoque.");
        return;
      }

      salvandoRef.current = true;
      setSalvando(true);

      const response = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          categoria: form.categoria,
          tipoUnidade: form.tipoUnidade,
          quantidadePorEmbalagem,
          quantidadeEmbalagens,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.field && (data.field === "quantidadePorEmbalagem" || data.field === "quantidadeEmbalagens")) {
          setErrosQuantidade({ [data.field]: data.error ?? "Informe uma quantidade válida." });
        } else {
          setErro(data.error ?? "Não foi possível cadastrar o item. Tente novamente.");
        }
        return;
      }
      setForm((current) => ({
        ...current,
        quantidadePorEmbalagem: "",
        quantidadeEmbalagens: "",
      }));
      setErrosQuantidade({});
      setNomeAberto(false);
      setMensagem("Item cadastrado no estoque.");
      setCarregando(true);
      await carregarItens();
    } catch {
      setErro("Não foi possível comunicar com o servidor.");
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const unidadeSelecionada = STOCK_UNITS.find((unit) => unit.value === form.tipoUnidade);
  const quantidadeEmbalagensResumo = Number(form.quantidadeEmbalagens);
  const quantidadePorEmbalagemResumo = form.tipoUnidade === "unidade" ? 1 : Number(form.quantidadePorEmbalagem);
  const totalResumo = quantidadeEmbalagensResumo * quantidadePorEmbalagemResumo;
  const quantidadeResumoValida = (value: string, amount: number) => /^\d+$/.test(value)
    && amount >= 1
    && amount <= MAX_STOCK_INPUT;
  const resumoValido = Boolean(
    unidadeSelecionada
    && quantidadeResumoValida(form.quantidadeEmbalagens, quantidadeEmbalagensResumo)
    && (form.tipoUnidade === "unidade" || quantidadeResumoValida(form.quantidadePorEmbalagem, quantidadePorEmbalagemResumo))
    && Number.isSafeInteger(totalResumo)
    && totalResumo <= MAX_STOCK_BALANCE
  );
  const resumo = resumoValido && unidadeSelecionada
    ? form.tipoUnidade === "unidade"
      ? `${quantidadeEmbalagensResumo} ${unidadeSelecionada.plural}`
      : `${quantidadeEmbalagensResumo} ${quantidadeEmbalagensResumo === 1 ? unidadeSelecionada.singular : unidadeSelecionada.plural} × ${quantidadePorEmbalagemResumo} = ${totalResumo} ${unidadeSelecionada.baseUnit}`
    : unidadeSelecionada ? "Informe as quantidades válidas para ver o total." : "Selecione o tipo de unidade.";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8 md:flex md:h-dvh md:min-h-0 md:flex-col md:overflow-hidden md:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col md:min-h-0 md:flex-1">
        <header className="border-b border-slate-200 pb-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-royal">Almoxarifado Marcon</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Estoque</h1>
          <p className="text-sm text-slate-600">Cadastre e acompanhe os materiais disponíveis.</p>
        </header>

        <section className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Resumo do estoque">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm"><p className="text-sm text-slate-500">Itens cadastrados</p><p className="text-xl font-bold text-slate-950">{itens.length}</p></div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm"><p className="text-sm text-slate-500">Categorias</p><p className="text-xl font-bold text-slate-950">{new Set(itens.map((item) => item.categoria)).size}</p></div>
        </section>

        <div className="mt-4 grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section id="novo-item" className={`${styles.formPanel} min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm`}>
            <h2 className="text-lg font-bold text-slate-950">Novo item</h2>
            <form onSubmit={cadastrarItem} noValidate className={`${styles.formLayout} mt-2`}>
              <div className={`${styles.formBody} space-y-2`}>
              <div>
                <label htmlFor="categoria" className="text-xs font-semibold text-slate-800">Categoria</label>
                <select id="categoria" required value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value, nome: "" })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-royal focus:ring-2 focus:ring-royal/20">
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nome" className="text-xs font-semibold text-slate-800">Nome do material</label>
                <div className="relative mt-1">
                  <input id="nome" required disabled={!form.categoria} autoComplete="off" spellCheck={false} placeholder={form.categoria ? "Selecione ou digite o material" : "Selecione a categoria primeiro"} value={form.nome} onFocus={() => setNomeAberto(true)} onChange={(event) => { setForm({ ...form, nome: event.target.value }); setNomeAberto(true); }} className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-royal focus:ring-2 focus:ring-royal/20 disabled:cursor-not-allowed disabled:bg-slate-100" />
                  {nomeAberto && form.categoria && materiaisSugeridos.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-300 bg-white p-1 shadow-lg">
                    {materiaisSugeridos.map((material) => <button key={material} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setForm({ ...form, nome: material }); setNomeAberto(false); }} className="block w-full rounded-md px-3 py-2 text-left text-sm leading-5 text-slate-800 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">{material}</button>)}
                  </div>}
                </div>
              </div>
              <div>
                <label htmlFor="tipoUnidade" className="text-xs font-semibold text-slate-800">Tipo de unidade</label>
                <select id="tipoUnidade" required value={form.tipoUnidade} onChange={(event) => {
                  const tipoUnidade = event.target.value as StockUnit | "";
                  setForm((current) => ({
                    ...current,
                    tipoUnidade,
                    quantidadePorEmbalagem: "",
                    quantidadeEmbalagens: "",
                  }));
                  setErrosQuantidade({});
                  setErro("");
                }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-royal focus:ring-2 focus:ring-royal/20">
                  <option value="">Selecione o tipo de unidade</option>
                  {STOCK_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                </select>
              </div>
              <div key={form.tipoUnidade} className={styles.quantityFields}>
                {!unidadeSelecionada ? null : <div className={form.tipoUnidade === "unidade" ? "" : "grid gap-2 md:grid-cols-2"}>
                  {form.tipoUnidade !== "unidade" && <div>
                    <label htmlFor="quantidadePorEmbalagem" className="text-xs font-semibold text-slate-800">Quantidade por {unidadeSelecionada.singular}</label>
                    <input id="quantidadePorEmbalagem" required type="number" inputMode="numeric" min={1} max={MAX_STOCK_INPUT} step={1} value={form.quantidadePorEmbalagem} aria-invalid={Boolean(errosQuantidade.quantidadePorEmbalagem)} aria-describedby={errosQuantidade.quantidadePorEmbalagem ? "quantidadePorEmbalagem-erro" : undefined} onChange={(event) => {
                      setForm((current) => ({ ...current, quantidadePorEmbalagem: event.target.value }));
                      setErrosQuantidade((current) => ({ ...current, quantidadePorEmbalagem: undefined }));
                    }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-royal focus:ring-2 focus:ring-royal/20 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20" />
                    {errosQuantidade.quantidadePorEmbalagem && <p id="quantidadePorEmbalagem-erro" className="mt-1 text-xs text-red-700">{errosQuantidade.quantidadePorEmbalagem}</p>}
                  </div>}
                  <div>
                    <label htmlFor="quantidadeEmbalagens" className="text-xs font-semibold text-slate-800">Quantidade de {unidadeSelecionada.countLabel}</label>
                    <input id="quantidadeEmbalagens" required type="number" inputMode="numeric" min={1} max={MAX_STOCK_INPUT} step={1} value={form.quantidadeEmbalagens} aria-invalid={Boolean(errosQuantidade.quantidadeEmbalagens)} aria-describedby={errosQuantidade.quantidadeEmbalagens ? "quantidadeEmbalagens-erro" : undefined} onChange={(event) => {
                      setForm((current) => ({ ...current, quantidadeEmbalagens: event.target.value }));
                      setErrosQuantidade((current) => ({ ...current, quantidadeEmbalagens: undefined }));
                    }} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-royal focus:ring-2 focus:ring-royal/20 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20" />
                    {errosQuantidade.quantidadeEmbalagens && <p id="quantidadeEmbalagens-erro" className="mt-1 text-xs text-red-700">{errosQuantidade.quantidadeEmbalagens}</p>}
                  </div>
                </div>}
              </div>
              </div>
              <div className={styles.formFooter}>
              {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
              {mensagem && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensagem}</p>}
              <p aria-live="polite" className="min-h-5 text-sm font-medium text-slate-600">{resumo}</p>
              <button type="submit" disabled={salvando} className="mt-2 min-h-10 w-full rounded-lg bg-royal px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-300">{salvando ? "Salvando..." : "Cadastrar item"}</button>
              </div>
            </form>
          </section>

          <section className={`${styles.stockPanel} rounded-xl border border-slate-200 bg-white p-6 shadow-sm`}>
            <div className={styles.stockHeader}>
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <h2 className="text-center text-xl font-bold text-slate-950 sm:col-start-2">Itens do estoque</h2>
              <div className="flex flex-col gap-2 sm:col-start-3 sm:flex-row sm:justify-self-end">
                <select aria-label="Filtrar por categoria" value={categoriaBusca} onChange={(event) => setCategoriaBusca(event.target.value)} className="w-40 min-w-0 truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-royal">
                  <option value="">Todas as categorias</option>
                  {categorias.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
                <input aria-label="Buscar item por nome ou categoria" placeholder="Buscar material ou categoria" value={busca} onChange={(event) => setBusca(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-royal sm:w-48" />
              </div>
            </div>
            </div>
            <div ref={listaRef} tabIndex={0} aria-label="Lista de itens do estoque" className={`${styles.stockBody} mt-5 space-y-3 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal`}>
              {carregando ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Carregando estoque...</p> : erroLista ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">{erroLista}</p> : itensFiltrados.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Nenhum item encontrado.</p> : itensFiltrados.map((item) => {
                const tipoUltimaEntrada = item.tipoUnidade ? STOCK_UNITS.find((unit) => unit.value === item.tipoUnidade) : undefined;
                return <article key={item.id} tabIndex={0} className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold text-slate-900">{item.nome}</p><p className="mt-1 text-sm text-slate-500">{item.categoria} · unidade: {item.unidade}</p><p className="mt-2 text-sm text-slate-600">Em estoque: <strong>{item.quantidade} {item.unidade}</strong></p><p className="mt-1 text-sm text-slate-600">Ponto de pedido: {item.pontoPedido} {item.unidade}</p>{isAtOrBelowReorderPoint(item.quantidade, item.pontoPedido) && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Repor · saldo no ponto de pedido ou abaixo</span>}{item.quantidadeDeposito > 0 && <p className="mt-1 text-sm font-medium text-emerald-700">No depósito: {item.quantidadeDeposito} un</p>}</div>
                  {tipoUltimaEntrada && item.ultimaEntradaEmbalagens !== null && item.quantidadePorEmbalagem !== null && <p className="text-sm text-slate-500">Última entrada: {item.ultimaEntradaEmbalagens} {item.ultimaEntradaEmbalagens === 1 ? tipoUltimaEntrada.singular : tipoUltimaEntrada.plural}{item.tipoUnidade === "unidade" ? "" : ` de ${item.quantidadePorEmbalagem}`}</p>}
                  <div className="text-sm font-semibold text-slate-700">Disponível</div>
                </article>;
              })}
            </div>
          </section>
        </div>
      </div>
      <footer className="mx-auto mt-10 w-full max-w-7xl border-t border-slate-200 pt-4 text-center text-xs text-slate-400 md:mt-auto md:shrink-0">
        Almoxarifado Marcon
      </footer>
    </main>
  );
}