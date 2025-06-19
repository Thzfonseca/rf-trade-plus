import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import './App.css';

// Função para calcular valor futuro
const calcularValorFuturo = (valorInicial, indexador, taxa, prazo, premissas, horizonte, tipoReinvestimento, taxasReinvestimento, aliquotaIR) => {
  let valor = valorInicial;
  
  for (let ano = 1; ano <= horizonte; ano++) {
    if (ano <= prazo) {
      // Período do ativo principal
      if (indexador === 'pre') {
        valor *= (1 + taxa / 100);
      } else if (indexador === 'pos') {
        const cdiAno = premissas.cdi[Math.min(ano - 1, premissas.cdi.length - 1)];
        valor *= (1 + (cdiAno * taxa / 100) / 100);
      } else if (indexador === 'ipca') {
        const ipcaAno = premissas.ipca[Math.min(ano - 1, premissas.ipca.length - 1)];
        valor *= (1 + (ipcaAno + taxa) / 100);
      }
    } else {
      // Período de reinvestimento com taxa específica
      if (tipoReinvestimento === 'cdi') {
        const cdiAno = premissas.cdi[Math.min(ano - 1, premissas.cdi.length - 1)];
        valor *= (1 + (cdiAno * taxasReinvestimento.cdi / 100) / 100);
      } else if (tipoReinvestimento === 'ipca') {
        const ipcaAno = premissas.ipca[Math.min(ano - 1, premissas.ipca.length - 1)];
        valor *= (1 + (ipcaAno + taxasReinvestimento.ipca) / 100);
      } else if (tipoReinvestimento === 'pre') {
        valor *= (1 + taxasReinvestimento.pre / 100);
      }
    }
  }
  
  // Aplicar IR apenas no rendimento do ativo principal
  if (aliquotaIR > 0) {
    const rendimento = valor - valorInicial;
    const ir = rendimento * (aliquotaIR / 100);
    valor -= ir;
  }
  
  return valor;
};

// Função para simular Monte Carlo AVANÇADA
const simularMonteCarloAvancado = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const simulacoes = 10000;
  const resultados = [];
  const trajetorias = [];
  
  for (let i = 0; i < simulacoes; i++) {
    // Gerar variações aleatórias nas premissas
    const premissasVariadas = {
      cdi: premissas.cdi.map(taxa => Math.max(0, taxa + (Math.random() - 0.5) * 4)),
      ipca: premissas.ipca.map(taxa => Math.max(0, taxa + (Math.random() - 0.5) * 2))
    };
    
    const valorAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissasVariadas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      {
        cdi: ativoAtual.taxaReinvestimentoCDI,
        ipca: ativoAtual.taxaReinvestimentoIPCA,
        pre: ativoAtual.taxaReinvestimentoPre
      },
      ativoAtual.aliquotaIR
    );

    const valorProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissasVariadas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );

    const vantagem = valorProposto - valorAtual;
    const vantagemPercentual = (vantagem / valorAtual) * 100;
    resultados.push({ vantagem, vantagemPercentual, valorAtual, valorProposto });
    
    // Guardar algumas trajetórias para visualização
    if (i < 100) {
      trajetorias.push({ valorAtual, valorProposto, vantagem });
    }
  }
  
  // Calcular estatísticas avançadas
  const vantagens = resultados.map(r => r.vantagem);
  const percentuais = resultados.map(r => r.vantagemPercentual);
  
  vantagens.sort((a, b) => a - b);
  percentuais.sort((a, b) => a - b);
  
  const media = vantagens.reduce((sum, val) => sum + val, 0) / simulacoes;
  const mediana = vantagens[Math.floor(simulacoes * 0.5)];
  const desvio = Math.sqrt(vantagens.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / simulacoes);
  
  // Percentis importantes
  const percentis = {
    p5: vantagens[Math.floor(simulacoes * 0.05)],
    p10: vantagens[Math.floor(simulacoes * 0.10)],
    p25: vantagens[Math.floor(simulacoes * 0.25)],
    p75: vantagens[Math.floor(simulacoes * 0.75)],
    p90: vantagens[Math.floor(simulacoes * 0.90)],
    p95: vantagens[Math.floor(simulacoes * 0.95)]
  };
  
  // Análise de risco
  const probabilidadeSucesso = (vantagens.filter(v => v > 0).length / simulacoes) * 100;
  const probabilidadePerda = (vantagens.filter(v => v < -50000).length / simulacoes) * 100;
  const probabilidadeGanhoAlto = (vantagens.filter(v => v > 100000).length / simulacoes) * 100;
  
  // Distribuição por faixas
  const faixas = [
    { nome: 'Perda > R$ 100k', min: -Infinity, max: -100000, cor: '#dc2626' },
    { nome: 'Perda R$ 50k-100k', min: -100000, max: -50000, cor: '#ef4444' },
    { nome: 'Perda < R$ 50k', min: -50000, max: 0, cor: '#f87171' },
    { nome: 'Ganho < R$ 50k', min: 0, max: 50000, cor: '#84cc16' },
    { nome: 'Ganho R$ 50k-100k', min: 50000, max: 100000, cor: '#22c55e' },
    { nome: 'Ganho > R$ 100k', min: 100000, max: Infinity, cor: '#16a34a' }
  ];
  
  const distribuicaoFaixas = faixas.map(faixa => {
    const count = vantagens.filter(v => v >= faixa.min && v < faixa.max).length;
    return {
      ...faixa,
      count,
      percentual: (count / simulacoes) * 100
    };
  });
  
  // Gerar histograma
  const bins = 50;
  const minVal = Math.min(...vantagens);
  const maxVal = Math.max(...vantagens);
  const binSize = (maxVal - minVal) / bins;
  
  const histograma = [];
  for (let i = 0; i < bins; i++) {
    const binStart = minVal + i * binSize;
    const binEnd = binStart + binSize;
    const count = vantagens.filter(v => v >= binStart && v < binEnd).length;
    
    histograma.push({
      bin: binStart + binSize / 2,
      frequencia: count,
      favoravel: binStart + binSize / 2 > 0
    });
  }
  
  // Métricas de risco
  const sharpeRatio = media / desvio;
  const sortinoRatio = media / Math.sqrt(vantagens.filter(v => v < 0).reduce((sum, val) => sum + Math.pow(val, 2), 0) / vantagens.filter(v => v < 0).length || 1);
  const maxDrawdown = Math.min(...vantagens);
  
  return {
    media,
    mediana,
    desvio,
    percentis,
    probabilidadeSucesso,
    probabilidadePerda,
    probabilidadeGanhoAlto,
    distribuicaoFaixas,
    histograma,
    trajetorias,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    resultados: vantagens
  };
};

// Função para gerar dados dos gráficos
const gerarDadosGraficos = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const dadosEvolucao = [];
  const dadosRentabilidade = [];
  
  let valorAtualAcum = ativoAtual.valorInvestido;
  let valorPropostoAcum = ativoAtual.valorInvestido;
  
  for (let ano = 1; ano <= horizonte; ano++) {
    // Calcular valores acumulados
    valorAtualAcum = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissas,
      ano,
      ativoAtual.tipoReinvestimento,
      {
        cdi: ativoAtual.taxaReinvestimentoCDI || 100,
        ipca: ativoAtual.taxaReinvestimentoIPCA || 6,
        pre: ativoAtual.taxaReinvestimentoPre || 12
      },
      ativoAtual.aliquotaIR
    );

    valorPropostoAcum = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissas,
      ano,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );

    dadosEvolucao.push({
      ano: `Ano ${ano}`,
      atual: valorAtualAcum,
      proposto: valorPropostoAcum,
      vencimentoAtual: ano === ativoAtual.prazo,
      vencimentoProposto: ano === ativoProposto.prazo
    });

    // Calcular rentabilidade anualizada
    if (ano > 0) {
      const rentabilidadeAtual = (Math.pow(valorAtualAcum / ativoAtual.valorInvestido, 1/ano) - 1) * 100;
      const rentabilidadeProposta = (Math.pow(valorPropostoAcum / ativoAtual.valorInvestido, 1/ano) - 1) * 100;

      dadosRentabilidade.push({
        ano: `Ano ${ano}`,
        atual: rentabilidadeAtual,
        proposto: rentabilidadeProposta
      });
    }
  }
  
  return { dadosEvolucao, dadosRentabilidade };
};

// Função para calcular breakeven
const calcularBreakeven = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const valorAtual = calcularValorFuturo(
    ativoAtual.valorInvestido,
    ativoAtual.indexador,
    ativoAtual.taxa,
    ativoAtual.prazo,
    premissas,
    horizonte,
    ativoAtual.tipoReinvestimento,
    {
      cdi: ativoAtual.taxaReinvestimentoCDI || 100,
      ipca: ativoAtual.taxaReinvestimentoIPCA || 6,
      pre: ativoAtual.taxaReinvestimentoPre || 12
    },
    ativoAtual.aliquotaIR
  );

  let taxaMin = 0;
  let taxaMax = 50;
  let taxaBreakeven = 0;
  
  // Busca binária para encontrar a taxa de breakeven
  for (let i = 0; i < 100; i++) {
    taxaBreakeven = (taxaMin + taxaMax) / 2;
    
    const valorProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      taxaBreakeven,
      ativoProposto.prazo,
      premissas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );
    
    const diferenca = valorProposto - valorAtual;
    
    if (Math.abs(diferenca) < 100) break;
    
    if (diferenca > 0) {
      taxaMax = taxaBreakeven;
    } else {
      taxaMin = taxaBreakeven;
    }
  }
  
  return taxaBreakeven;
};

// Função para gerar análise de cenários INTUITIVA
const gerarCenariosIntuitivos = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const cdiBase = premissas.cdi[0];
  const ipcaBase = premissas.ipca[0];
  
  // Cenários mais intuitivos e visuais
  const cenarios = [
    { 
      nome: "Conservador", 
      emoji: "🛡️",
      cdi: cdiBase - 1, 
      ipca: ipcaBase - 0.5, 
      descricao: "Economia estável, juros em queda",
      probabilidade: 30,
      cor: "#22c55e"
    },
    { 
      nome: "Atual", 
      emoji: "📊",
      cdi: cdiBase, 
      ipca: ipcaBase, 
      descricao: "Suas premissas atuais",
      probabilidade: 40,
      cor: "#3b82f6"
    },
    { 
      nome: "Stress", 
      emoji: "⚠️",
      cdi: cdiBase + 2, 
      ipca: ipcaBase + 1.5, 
      descricao: "Crise econômica, alta volatilidade",
      probabilidade: 20,
      cor: "#ef4444"
    },
    { 
      nome: "Hiperinflação", 
      emoji: "🔥",
      cdi: cdiBase + 3, 
      ipca: ipcaBase + 3, 
      descricao: "Cenário extremo inflacionário",
      probabilidade: 10,
      cor: "#dc2626"
    }
  ];
  
  const resultados = cenarios.map(cenario => {
    const premissasVariadas = {
      cdi: premissas.cdi.map(() => Math.max(0, cenario.cdi)),
      ipca: premissas.ipca.map(() => Math.max(0, cenario.ipca))
    };
    
    const valorFinalAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissasVariadas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      {
        cdi: ativoAtual.taxaReinvestimentoCDI || 100,
        ipca: ativoAtual.taxaReinvestimentoIPCA || 6,
        pre: ativoAtual.taxaReinvestimentoPre || 12
      },
      ativoAtual.aliquotaIR
    );

    const valorFinalProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissasVariadas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );

    const vantagem = valorFinalProposto - valorFinalAtual;
    const vantagemAnualizada = (Math.pow(valorFinalProposto / valorFinalAtual, 1/horizonte) - 1) * 100;

    return {
      ...cenario,
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemAnualizada,
      favoravel: vantagem > 0,
      impacto: Math.abs(vantagem) > 50000 ? 'Alto' : Math.abs(vantagem) > 20000 ? 'Médio' : 'Baixo'
    };
  });
  
  return resultados;
};

// Função para analisar tendência das premissas
const analisarTendenciaPremissas = (premissas) => {
  const cdiInicial = premissas.cdi[0];
  const cdiFinal = premissas.cdi[premissas.cdi.length - 1];
  const ipcaInicial = premissas.ipca[0];
  const ipcaFinal = premissas.ipca[premissas.ipca.length - 1];

  const tendenciaCDI = cdiFinal > cdiInicial ? 'alta' : cdiFinal < cdiInicial ? 'queda' : 'estável';
  const tendenciaIPCA = ipcaFinal > ipcaInicial ? 'alta' : ipcaFinal < ipcaInicial ? 'queda' : 'estável';

  if (tendenciaCDI === 'alta' && tendenciaIPCA === 'alta') return 'pessimista';
  if (tendenciaCDI === 'queda' && tendenciaIPCA === 'queda') return 'otimista';
  return 'moderado';
};

// Função para formatar valores
const formatarValor = (valor) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
};

const formatarValorMilhoes = (valor) => {
  if (Math.abs(valor) >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1)}M`;
  }
  return formatarValor(valor);
};

const formatarPercentual = (valor) => {
  return `${valor.toFixed(1)}%`;
};

function App() {
  // Estados para premissas macroeconômicas
  const [premissas, setPremissas] = useState({
    cdi: [14, 12, 11, 10, 9],
    ipca: [5.5, 5.0, 4.5, 4.0, 3.5]
  });

  // Estados para ativo atual
  const [ativoAtual, setAtivoAtual] = useState({
    indexador: 'ipca',
    taxa: 9,
    prazo: 2,
    valorInvestido: 1000000,
    tipoReinvestimento: 'cdi',
    taxaReinvestimentoCDI: 100,
    taxaReinvestimentoIPCA: 6,
    taxaReinvestimentoPre: 12,
    aliquotaIR: 0
  });

  // Estados para ativo proposto
  const [ativoProposto, setAtivoProposto] = useState({
    indexador: 'ipca',
    taxa: 7.5,
    prazo: 10,
    aliquotaIR: 0
  });

  const [resultados, setResultados] = useState(null);
  const [monteCarlo, setMonteCarlo] = useState(null);
  const [breakeven, setBreakeven] = useState(null);
  const [cenarios, setCenarios] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('resumo');

  // Calcular horizonte automaticamente
  const horizonte = Math.max(ativoAtual.prazo, ativoProposto.prazo);

  const calcularAnalise = () => {
    // Calcular valores finais
    const taxasReinvestimentoAtual = {
      cdi: ativoAtual.taxaReinvestimentoCDI || 100,
      ipca: ativoAtual.taxaReinvestimentoIPCA || 6,
      pre: ativoAtual.taxaReinvestimentoPre || 12
    };

    const valorFinalAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      taxasReinvestimentoAtual,
      ativoAtual.aliquotaIR
    );

    const valorFinalProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );

    const vantagem = valorFinalProposto - valorFinalAtual;
    const vantagemPercentual = (vantagem / valorFinalAtual) * 100;
    const vantagemAnualizada = (Math.pow(valorFinalProposto / valorFinalAtual, 1/horizonte) - 1) * 100;

    // Gerar dados dos gráficos
    const { dadosEvolucao, dadosRentabilidade } = gerarDadosGraficos(ativoAtual, ativoProposto, premissas, horizonte);

    // Simular Monte Carlo avançado
    const resultadosMonteCarlo = simularMonteCarloAvancado(ativoAtual, ativoProposto, premissas, horizonte);

    // Calcular breakeven
    const taxaBreakeven = calcularBreakeven(ativoAtual, ativoProposto, premissas, horizonte);

    // Gerar cenários intuitivos
    const cenariosIntuitivos = gerarCenariosIntuitivos(ativoAtual, ativoProposto, premissas, horizonte);

    setResultados({
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemPercentual,
      vantagemAnualizada,
      dadosEvolucao,
      dadosRentabilidade,
      tendencia: analisarTendenciaPremissas(premissas)
    });

    setMonteCarlo(resultadosMonteCarlo);
    setBreakeven(taxaBreakeven);
    setCenarios(cenariosIntuitivos);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>RF TRADE+</h1>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {/* Cards de Input COMPACTOS */}
          <div className="input-section">
            <div className="input-grid">
              {/* Card Premissas Compacto */}
              <div className="input-card premissas">
                <h3>📊 Premissas</h3>
                <div className="premissas-compact">
                  <div className="premissa-row">
                    <label>CDI (%)</label>
                    <div className="inputs-inline">
                      {premissas.cdi.map((valor, index) => (
                        <input
                          key={index}
                          type="number"
                          step="0.1"
                          value={valor}
                          onChange={(e) => {
                            const novasCDI = [...premissas.cdi];
                            novasCDI[index] = parseFloat(e.target.value) || 0;
                            setPremissas({...premissas, cdi: novasCDI});
                          }}
                          className="input-tiny"
                          placeholder={`A${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="premissa-row">
                    <label>IPCA (%)</label>
                    <div className="inputs-inline">
                      {premissas.ipca.map((valor, index) => (
                        <input
                          key={index}
                          type="number"
                          step="0.1"
                          value={valor}
                          onChange={(e) => {
                            const novasIPCA = [...premissas.ipca];
                            novasIPCA[index] = parseFloat(e.target.value) || 0;
                            setPremissas({...premissas, ipca: novasIPCA});
                          }}
                          className="input-tiny"
                          placeholder={`A${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Ativo Atual Compacto */}
              <div className="input-card atual">
                <h3>🔵 Ativo Atual</h3>
                <div className="ativo-compact">
                  <div className="ativo-row">
                    <select
                      value={ativoAtual.indexador}
                      onChange={(e) => setAtivoAtual({...ativoAtual, indexador: e.target.value})}
                      className="input-compact"
                    >
                      <option value="pre">Pré</option>
                      <option value="pos">Pós</option>
                      <option value="ipca">IPCA+</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={ativoAtual.taxa}
                      onChange={(e) => setAtivoAtual({...ativoAtual, taxa: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="Taxa %"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={ativoAtual.prazo}
                      onChange={(e) => setAtivoAtual({...ativoAtual, prazo: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="Anos"
                    />
                  </div>
                  <div className="ativo-row">
                    <input
                      type="number"
                      step="1000"
                      value={ativoAtual.valorInvestido}
                      onChange={(e) => setAtivoAtual({...ativoAtual, valorInvestido: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="Valor R$"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="22.5"
                      value={ativoAtual.aliquotaIR}
                      onChange={(e) => setAtivoAtual({...ativoAtual, aliquotaIR: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="IR %"
                    />
                  </div>
                  <div className="reinvest-compact">
                    <label>Reinvestimento:</label>
                    <div className="reinvest-options">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="reinvestimento"
                          value="cdi"
                          checked={ativoAtual.tipoReinvestimento === 'cdi'}
                          onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        />
                        CDI
                        <input
                          type="number"
                          value={ativoAtual.taxaReinvestimentoCDI || 100}
                          onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoCDI: parseFloat(e.target.value) || 100})}
                          className="input-mini"
                          disabled={ativoAtual.tipoReinvestimento !== 'cdi'}
                        />%
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="reinvestimento"
                          value="ipca"
                          checked={ativoAtual.tipoReinvestimento === 'ipca'}
                          onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        />
                        IPCA+
                        <input
                          type="number"
                          value={ativoAtual.taxaReinvestimentoIPCA || 6}
                          onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoIPCA: parseFloat(e.target.value) || 6})}
                          className="input-mini"
                          disabled={ativoAtual.tipoReinvestimento !== 'ipca'}
                        />%
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Ativo Proposto Compacto */}
              <div className="input-card proposto">
                <h3>🔷 Ativo Proposto</h3>
                <div className="ativo-compact">
                  <div className="ativo-row">
                    <select
                      value={ativoProposto.indexador}
                      onChange={(e) => setAtivoProposto({...ativoProposto, indexador: e.target.value})}
                      className="input-compact"
                    >
                      <option value="pre">Pré</option>
                      <option value="pos">Pós</option>
                      <option value="ipca">IPCA+</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={ativoProposto.taxa}
                      onChange={(e) => setAtivoProposto({...ativoProposto, taxa: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="Taxa %"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={ativoProposto.prazo}
                      onChange={(e) => setAtivoProposto({...ativoProposto, prazo: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="Anos"
                    />
                  </div>
                  <div className="ativo-row">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="22.5"
                      value={ativoProposto.aliquotaIR}
                      onChange={(e) => setAtivoProposto({...ativoProposto, aliquotaIR: parseFloat(e.target.value) || 0})}
                      className="input-compact"
                      placeholder="IR %"
                    />
                    <div className="horizonte-display">
                      <span>Horizonte: {horizonte} anos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="calculate-section">
              <button onClick={calcularAnalise} className="calculate-btn">
                Calcular Análise
              </button>
            </div>
          </div>

          {resultados && (
            <>
              {/* Abas */}
              <div className="tabs">
                <button 
                  className={`tab ${abaAtiva === 'resumo' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('resumo')}
                >
                  📊 Resumo
                </button>
                <button 
                  className={`tab ${abaAtiva === 'graficos' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('graficos')}
                >
                  📈 Gráficos
                </button>
                <button 
                  className={`tab ${abaAtiva === 'montecarlo' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('montecarlo')}
                >
                  🎲 Monte Carlo
                </button>
                <button 
                  className={`tab ${abaAtiva === 'cenarios' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('cenarios')}
                >
                  🎯 Cenários
                </button>
                <button 
                  className={`tab ${abaAtiva === 'relatorio' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('relatorio')}
                >
                  📝 Relatório
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="tab-content">
                {abaAtiva === 'resumo' && (
                  <div className="resumo-content">
                    <div className="metrics-grid">
                      <div className={`metric-card ${resultados.vantagem > 0 ? 'positive' : 'negative'}`}>
                        <h4>Vantagem Total</h4>
                        <div className="metric-value">{formatarValor(resultados.vantagem)}</div>
                        <div className="metric-label">Em {horizonte} anos</div>
                      </div>
                      <div className={`metric-card ${resultados.vantagemAnualizada > 0 ? 'positive' : 'negative'}`}>
                        <h4>Vantagem Anualizada</h4>
                        <div className="metric-value">{formatarPercentual(resultados.vantagemAnualizada)}</div>
                        <div className="metric-label">Por ano</div>
                      </div>
                      <div className="metric-card breakeven">
                        <h4>Taxa Breakeven</h4>
                        <div className="metric-value">{formatarPercentual(breakeven)}</div>
                        <div className="metric-label">Taxa de equilíbrio</div>
                      </div>
                      <div className="metric-card">
                        <h4>Valor Final Atual</h4>
                        <div className="metric-value">{formatarValor(resultados.valorFinalAtual)}</div>
                        <div className="metric-label">Estratégia atual</div>
                      </div>
                      <div className="metric-card">
                        <h4>Valor Final Proposto</h4>
                        <div className="metric-value">{formatarValor(resultados.valorFinalProposto)}</div>
                        <div className="metric-label">Nova estratégia</div>
                      </div>
                      {monteCarlo && (
                        <div className="metric-card">
                          <h4>Probabilidade de Sucesso</h4>
                          <div className="metric-value">{formatarPercentual(monteCarlo.probabilidadeSucesso)}</div>
                          <div className="metric-label">Monte Carlo</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {abaAtiva === 'graficos' && (
                  <div className="graficos-content">
                    <div className="chart-container">
                      <h4>Evolução Patrimonial</h4>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={resultados.dadosEvolucao}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="ano" />
                          <YAxis tickFormatter={formatarValorMilhoes} domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                          <Tooltip formatter={(value) => formatarValor(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="atual" stroke="#ef4444" strokeWidth={3} name="Estratégia Atual" />
                          <Line type="monotone" dataKey="proposto" stroke="#22c55e" strokeWidth={3} name="Estratégia Proposta" />
                          <ReferenceLine x={`Ano ${ativoAtual.prazo}`} stroke="#ef4444" strokeDasharray="5 5" label="Vencimento Atual" />
                          <ReferenceLine x={`Ano ${ativoProposto.prazo}`} stroke="#22c55e" strokeDasharray="5 5" label="Vencimento Proposto" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                      <h4>Rentabilidade Anualizada Acumulada</h4>
                      <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={resultados.dadosRentabilidade}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="ano" />
                          <YAxis tickFormatter={formatarPercentual} domain={['dataMin * 0.95', 'dataMax * 1.05']} />
                          <Tooltip formatter={(value) => formatarPercentual(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="atual" stroke="#ef4444" strokeWidth={3} name="Estratégia Atual" />
                          <Line type="monotone" dataKey="proposto" stroke="#22c55e" strokeWidth={3} name="Estratégia Proposta" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {abaAtiva === 'montecarlo' && monteCarlo && (
                  <div className="montecarlo-content">
                    <div className="montecarlo-intro">
                      <h3>🎲 Análise de Monte Carlo: Explorando a Incerteza</h3>
                      <p>
                        Imagine que você pudesse ver 10.000 futuros possíveis para sua decisão de investimento. 
                        É exatamente isso que a simulação de Monte Carlo faz: ela testa sua estratégia em milhares 
                        de cenários econômicos diferentes, revelando não apenas o resultado mais provável, mas toda 
                        a gama de possibilidades.
                      </p>
                    </div>

                    <div className="montecarlo-stats-grid">
                      <div className="stat-card expectativa">
                        <h4>💰 Expectativa</h4>
                        <div className="stat-value">{formatarValor(monteCarlo.media)}</div>
                        <div className="stat-desc">Resultado médio esperado</div>
                      </div>
                      <div className="stat-card probabilidade">
                        <h4>🎯 Probabilidade de Sucesso</h4>
                        <div className="stat-value">{formatarPercentual(monteCarlo.probabilidadeSucesso)}</div>
                        <div className="stat-desc">Chance de ganhar dinheiro</div>
                      </div>
                      <div className="stat-card risco">
                        <h4>⚠️ Risco de Perda</h4>
                        <div className="stat-value">{formatarPercentual(monteCarlo.probabilidadePerda)}</div>
                        <div className="stat-desc">Chance de perder &gt; R$ 50k</div>
                      </div>
                      <div className="stat-card upside">
                        <h4>🚀 Potencial de Ganho</h4>
                        <div className="stat-value">{formatarPercentual(monteCarlo.probabilidadeGanhoAlto)}</div>
                        <div className="stat-desc">Chance de ganhar &gt; R$ 100k</div>
                      </div>
                    </div>

                    <div className="montecarlo-charts">
                      <div className="chart-container">
                        <h4>Distribuição de Resultados</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monteCarlo.histograma}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bin" tickFormatter={formatarValorMilhoes} />
                            <YAxis />
                            <Tooltip formatter={(value, name) => [value, name === 'frequencia' ? 'Frequência' : 'Normal']} />
                            <Bar dataKey="frequencia" fill={(entry) => entry.favoravel ? '#22c55e' : '#ef4444'} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-container">
                        <h4>Distribuição por Faixas de Resultado</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={monteCarlo.distribuicaoFaixas}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="percentual"
                              label={({nome, percentual}) => `${nome}: ${percentual.toFixed(1)}%`}
                            >
                              {monteCarlo.distribuicaoFaixas.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.cor} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="montecarlo-insights">
                      <div className="insight-card">
                        <h4>🔍 O que isso significa?</h4>
                        <p>
                          <strong>Cenário Base:</strong> Em {monteCarlo.probabilidadeSucesso.toFixed(0)}% dos casos, 
                          a estratégia proposta supera a atual. O ganho médio esperado é de {formatarValor(monteCarlo.media)}.
                        </p>
                        <p>
                          <strong>Gestão de Risco:</strong> No pior cenário (5% das vezes), você pode ter uma 
                          desvantagem de até {formatarValor(monteCarlo.percentis.p5)}. No melhor cenário (5% das vezes), 
                          o ganho pode chegar a {formatarValor(monteCarlo.percentis.p95)}.
                        </p>
                        <p>
                          <strong>Decisão Recomendada:</strong> {monteCarlo.probabilidadeSucesso > 70 ? 
                            'A estratégia proposta apresenta alta probabilidade de sucesso e risco controlado.' :
                            monteCarlo.probabilidadeSucesso > 50 ?
                            'A estratégia proposta tem probabilidade moderada de sucesso. Avalie seu perfil de risco.' :
                            'A estratégia atual pode ser mais adequada dado o nível de incerteza.'}
                        </p>
                      </div>

                      <div className="percentis-card">
                        <h4>📊 Análise de Percentis</h4>
                        <div className="percentis-grid">
                          <div className="percentil">
                            <span className="percentil-label">5% (Pessimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p5)}</span>
                          </div>
                          <div className="percentil">
                            <span className="percentil-label">25% (Conservador)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p25)}</span>
                          </div>
                          <div className="percentil">
                            <span className="percentil-label">50% (Mediana)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.mediana)}</span>
                          </div>
                          <div className="percentil">
                            <span className="percentil-label">75% (Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p75)}</span>
                          </div>
                          <div className="percentil">
                            <span className="percentil-label">95% (Muito Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p95)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {abaAtiva === 'cenarios' && cenarios && (
                  <div className="cenarios-content">
                    <div className="cenarios-intro">
                      <h3>🎯 Análise de Cenários: Como sua estratégia se comporta?</h3>
                      <p>
                        Testamos sua decisão em 4 cenários econômicos distintos, cada um com probabilidades 
                        baseadas em análises históricas. Veja como sua estratégia se adapta a diferentes 
                        condições de mercado.
                      </p>
                    </div>

                    <div className="cenarios-visual">
                      {cenarios.map((cenario, index) => (
                        <div key={index} className={`cenario-card ${cenario.favoravel ? 'favoravel' : 'desfavoravel'}`}>
                          <div className="cenario-header">
                            <span className="cenario-emoji">{cenario.emoji}</span>
                            <div className="cenario-info">
                              <h4>{cenario.nome}</h4>
                              <p>{cenario.descricao}</p>
                              <span className="probabilidade">Probabilidade: {cenario.probabilidade}%</span>
                            </div>
                          </div>
                          
                          <div className="cenario-metrics">
                            <div className="metric">
                              <span className="metric-label">CDI</span>
                              <span className="metric-value">{formatarPercentual(cenario.cdi)}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">IPCA</span>
                              <span className="metric-value">{formatarPercentual(cenario.ipca)}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Vantagem</span>
                              <span className={`metric-value ${cenario.favoravel ? 'positive' : 'negative'}`}>
                                {formatarValor(cenario.vantagem)}
                              </span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Impacto</span>
                              <span className={`metric-value impact-${cenario.impacto.toLowerCase()}`}>
                                {cenario.impacto}
                              </span>
                            </div>
                          </div>

                          <div className="cenario-bar">
                            <div 
                              className={`bar-fill ${cenario.favoravel ? 'positive' : 'negative'}`}
                              style={{width: `${Math.min(Math.abs(cenario.vantagemAnualizada) * 10, 100)}%`}}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="cenarios-summary">
                      <div className="summary-card">
                        <h4>📈 Resumo da Análise</h4>
                        <div className="summary-stats">
                          <div className="summary-stat">
                            <span className="stat-label">Cenários Favoráveis</span>
                            <span className="stat-value">
                              {cenarios.filter(c => c.favoravel).length} de {cenarios.length}
                            </span>
                          </div>
                          <div className="summary-stat">
                            <span className="stat-label">Probabilidade Ponderada</span>
                            <span className="stat-value">
                              {formatarPercentual(
                                cenarios.reduce((acc, c) => acc + (c.favoravel ? c.probabilidade : 0), 0)
                              )}
                            </span>
                          </div>
                          <div className="summary-stat">
                            <span className="stat-label">Maior Risco</span>
                            <span className="stat-value">
                              {cenarios.find(c => c.impacto === 'Alto' && !c.favoravel)?.nome || 'Baixo'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="recommendation">
                          <h5>💡 Recomendação</h5>
                          <p>
                            {cenarios.filter(c => c.favoravel).length >= 3 ?
                              'A estratégia proposta demonstra robustez em múltiplos cenários econômicos. Recomendamos a migração.' :
                              cenarios.filter(c => c.favoravel).length >= 2 ?
                              'A estratégia proposta apresenta resultados mistos. Considere seu perfil de risco antes de decidir.' :
                              'A estratégia atual pode ser mais adequada dado os riscos identificados nos cenários testados.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {abaAtiva === 'relatorio' && (
                  <div className="relatorio-content">
                    <div className="relatorio-header">
                      <h3>📝 Relatório Executivo</h3>
                      <button 
                        className="copy-button"
                        onClick={() => {
                          const texto = document.querySelector('.relatorio-body').innerText;
                          navigator.clipboard.writeText(texto);
                        }}
                      >
                        Copiar Relatório
                      </button>
                    </div>
                    
                    <div className="relatorio-body">
                      <h4>Análise Comparativa de Estratégias de Renda Fixa</h4>
                      
                      <p>
                        <strong>Resumo Executivo:</strong> Análise comparativa entre a estratégia atual 
                        ({ativoAtual.indexador.toUpperCase()} {formatarPercentual(ativoAtual.taxa)} por {ativoAtual.prazo} anos) 
                        e a oportunidade proposta ({ativoProposto.indexador.toUpperCase()} {formatarPercentual(ativoProposto.taxa)} por {ativoProposto.prazo} anos), 
                        considerando um horizonte de investimento de {horizonte} anos e valor inicial de {formatarValor(ativoAtual.valorInvestido)}.
                      </p>

                      <p>
                        <strong>Resultados Determinísticos:</strong> Sob as premissas macroeconômicas estabelecidas 
                        (CDI iniciando em {formatarPercentual(premissas.cdi[0])} e IPCA em {formatarPercentual(premissas.ipca[0])}), 
                        a estratégia proposta apresenta vantagem de {formatarValor(resultados.vantagem)} 
                        ({formatarPercentual(resultados.vantagemAnualizada)} ao ano) em relação à estratégia atual.
                      </p>

                      {monteCarlo && (
                        <p>
                          <strong>Análise de Risco (Monte Carlo):</strong> A simulação de 10.000 cenários revela 
                          probabilidade de sucesso de {formatarPercentual(monteCarlo.probabilidadeSucesso)}, 
                          com expectativa de ganho médio de {formatarValor(monteCarlo.media)}. 
                          O Value at Risk (VaR 95%) indica que, no pior cenário (5% das simulações), 
                          a desvantagem pode atingir {formatarValor(monteCarlo.percentis.p5)}.
                        </p>
                      )}

                      {cenarios && (
                        <p>
                          <strong>Análise de Cenários:</strong> Dos {cenarios.length} cenários econômicos testados, 
                          {cenarios.filter(c => c.favoravel).length} apresentam resultados favoráveis à migração. 
                          A probabilidade ponderada de sucesso, considerando as probabilidades históricas de cada cenário, 
                          é de {formatarPercentual(cenarios.reduce((acc, c) => acc + (c.favoravel ? c.probabilidade : 0), 0))}.
                        </p>
                      )}

                      <p>
                        <strong>Considerações sobre Reinvestimento:</strong> A análise considera reinvestimento 
                        {ativoAtual.prazo < ativoProposto.prazo ? 
                          `do ativo atual em ${ativoAtual.tipoReinvestimento.toUpperCase()} após ${ativoAtual.prazo} anos` :
                          `do ativo proposto em CDI após ${ativoProposto.prazo} anos`
                        } para equalizar o horizonte de investimento.
                      </p>

                      <p>
                        <strong>Recomendação:</strong> {
                          resultados.vantagem > 0 && monteCarlo?.probabilidadeSucesso > 70 ?
                            'MIGRAR - A estratégia proposta apresenta vantagem consistente com risco controlado.' :
                            resultados.vantagem > 0 && monteCarlo?.probabilidadeSucesso > 50 ?
                            'CONSIDERAR - A estratégia proposta oferece vantagem, mas requer avaliação do perfil de risco.' :
                            'MANTER - A estratégia atual demonstra maior adequação ao cenário analisado.'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>Desenvolvido por Thomaz Fonseca</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

