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

// Função para simular Monte Carlo PROFISSIONAL
const simularMonteCarloAvancado = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const simulacoes = 10000;
  const resultados = [];
  
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
  
  // Análise de probabilidades
  const probabilidadeResultadoPositivo = (vantagens.filter(v => v > 0).length / simulacoes) * 100;
  const probabilidadeResultadoNegativo = (vantagens.filter(v => v < 0).length / simulacoes) * 100;
  const probabilidadeResultadoSignificativo = (vantagens.filter(v => Math.abs(v) > 50000).length / simulacoes) * 100;
  
  // Distribuição por faixas
  const faixas = [
    { nome: 'Resultado muito negativo', min: -Infinity, max: -100000, count: 0 },
    { nome: 'Resultado negativo', min: -100000, max: -25000, count: 0 },
    { nome: 'Resultado neutro negativo', min: -25000, max: 0, count: 0 },
    { nome: 'Resultado neutro positivo', min: 0, max: 25000, count: 0 },
    { nome: 'Resultado positivo', min: 25000, max: 100000, count: 0 },
    { nome: 'Resultado muito positivo', min: 100000, max: Infinity, count: 0 }
  ];
  
  vantagens.forEach(v => {
    faixas.forEach(faixa => {
      if (v >= faixa.min && v < faixa.max) {
        faixa.count++;
      }
    });
  });
  
  const distribuicaoFaixas = faixas.map(faixa => ({
    ...faixa,
    percentual: (faixa.count / simulacoes) * 100
  }));
  
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
      categoria: binStart + binSize / 2 > 0 ? 'positivo' : 'negativo'
    });
  }
  
  return {
    media,
    mediana,
    desvio,
    percentis,
    probabilidadeResultadoPositivo,
    probabilidadeResultadoNegativo,
    probabilidadeResultadoSignificativo,
    distribuicaoFaixas,
    histograma,
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

// Função para gerar cenários econômicos
const gerarCenariosEconomicos = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const cdiBase = premissas.cdi[0];
  const ipcaBase = premissas.ipca[0];
  
  const cenarios = [
    { 
      nome: "Conservador", 
      emoji: "🛡️",
      cdi: cdiBase - 1, 
      ipca: ipcaBase - 0.5, 
      descricao: "Economia estável, juros em queda",
      probabilidade: 30
    },
    { 
      nome: "Base", 
      emoji: "📊",
      cdi: cdiBase, 
      ipca: ipcaBase, 
      descricao: "Suas premissas atuais",
      probabilidade: 40
    },
    { 
      nome: "Stress", 
      emoji: "⚠️",
      cdi: cdiBase + 2, 
      ipca: ipcaBase + 1.5, 
      descricao: "Pressão inflacionária, alta de juros",
      probabilidade: 20
    },
    { 
      nome: "Adverso", 
      emoji: "🔥",
      cdi: cdiBase + 3, 
      ipca: ipcaBase + 3, 
      descricao: "Cenário macroeconômico adverso",
      probabilidade: 10
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
      resultadoFavoravel: vantagem > 0,
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

    // Simular Monte Carlo
    const resultadosMonteCarlo = simularMonteCarloAvancado(ativoAtual, ativoProposto, premissas, horizonte);

    // Calcular breakeven
    const taxaBreakeven = calcularBreakeven(ativoAtual, ativoProposto, premissas, horizonte);

    // Gerar cenários
    const cenariosEconomicos = gerarCenariosEconomicos(ativoAtual, ativoProposto, premissas, horizonte);

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
    setCenarios(cenariosEconomicos);
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
          {/* Cards de Input SIMÉTRICOS */}
          <div className="input-section">
            <div className="input-grid-symmetric">
              {/* Card Premissas */}
              <div className="input-card">
                <div className="card-header">
                  <h3>📊 Premissas Macroeconômicas</h3>
                  <p>Projeções anuais para o horizonte de análise</p>
                </div>
                <div className="card-content">
                  <div className="premissa-group">
                    <label className="input-label">Taxa CDI (%)</label>
                    <div className="inputs-row">
                      {premissas.cdi.map((valor, index) => (
                        <div key={index} className="input-wrapper">
                          <input
                            type="number"
                            step="0.1"
                            value={valor}
                            onChange={(e) => {
                              const novasCDI = [...premissas.cdi];
                              novasCDI[index] = parseFloat(e.target.value) || 0;
                              setPremissas({...premissas, cdi: novasCDI});
                            }}
                            className="input-field"
                          />
                          <span className="input-label-small">Ano {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="premissa-group">
                    <label className="input-label">IPCA (%)</label>
                    <div className="inputs-row">
                      {premissas.ipca.map((valor, index) => (
                        <div key={index} className="input-wrapper">
                          <input
                            type="number"
                            step="0.1"
                            value={valor}
                            onChange={(e) => {
                              const novasIPCA = [...premissas.ipca];
                              novasIPCA[index] = parseFloat(e.target.value) || 0;
                              setPremissas({...premissas, ipca: novasIPCA});
                            }}
                            className="input-field"
                          />
                          <span className="input-label-small">Ano {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Ativo Atual */}
              <div className="input-card">
                <div className="card-header">
                  <h3>🔵 Ativo Atual</h3>
                  <p>Características do investimento atual</p>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Indexador</label>
                      <select
                        value={ativoAtual.indexador}
                        onChange={(e) => setAtivoAtual({...ativoAtual, indexador: e.target.value})}
                        className="input-field"
                      >
                        <option value="pre">Pré-fixado</option>
                        <option value="pos">Pós-fixado (CDI)</option>
                        <option value="ipca">IPCA+</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="input-label">Taxa (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ativoAtual.taxa}
                        onChange={(e) => setAtivoAtual({...ativoAtual, taxa: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Prazo (anos)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={ativoAtual.prazo}
                        onChange={(e) => setAtivoAtual({...ativoAtual, prazo: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label">Valor (R$)</label>
                      <input
                        type="number"
                        step="1000"
                        value={ativoAtual.valorInvestido}
                        onChange={(e) => setAtivoAtual({...ativoAtual, valorInvestido: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Alíquota IR (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="22.5"
                        value={ativoAtual.aliquotaIR}
                        onChange={(e) => setAtivoAtual({...ativoAtual, aliquotaIR: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="reinvestimento-section">
                    <label className="input-label">Reinvestimento após vencimento</label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="reinvestimento"
                          value="cdi"
                          checked={ativoAtual.tipoReinvestimento === 'cdi'}
                          onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        />
                        <span>CDI</span>
                        <input
                          type="number"
                          value={ativoAtual.taxaReinvestimentoCDI || 100}
                          onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoCDI: parseFloat(e.target.value) || 100})}
                          className="input-mini"
                          disabled={ativoAtual.tipoReinvestimento !== 'cdi'}
                        />
                        <span>%</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="reinvestimento"
                          value="ipca"
                          checked={ativoAtual.tipoReinvestimento === 'ipca'}
                          onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        />
                        <span>IPCA+</span>
                        <input
                          type="number"
                          value={ativoAtual.taxaReinvestimentoIPCA || 6}
                          onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoIPCA: parseFloat(e.target.value) || 6})}
                          className="input-mini"
                          disabled={ativoAtual.tipoReinvestimento !== 'ipca'}
                        />
                        <span>%</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="reinvestimento"
                          value="pre"
                          checked={ativoAtual.tipoReinvestimento === 'pre'}
                          onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        />
                        <span>Pré</span>
                        <input
                          type="number"
                          value={ativoAtual.taxaReinvestimentoPre || 12}
                          onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoPre: parseFloat(e.target.value) || 12})}
                          className="input-mini"
                          disabled={ativoAtual.tipoReinvestimento !== 'pre'}
                        />
                        <span>%</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Ativo Proposto */}
              <div className="input-card">
                <div className="card-header">
                  <h3>🔷 Ativo Proposto</h3>
                  <p>Características da nova oportunidade</p>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Indexador</label>
                      <select
                        value={ativoProposto.indexador}
                        onChange={(e) => setAtivoProposto({...ativoProposto, indexador: e.target.value})}
                        className="input-field"
                      >
                        <option value="pre">Pré-fixado</option>
                        <option value="pos">Pós-fixado (CDI)</option>
                        <option value="ipca">IPCA+</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="input-label">Taxa (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ativoProposto.taxa}
                        onChange={(e) => setAtivoProposto({...ativoProposto, taxa: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Prazo (anos)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={ativoProposto.prazo}
                        onChange={(e) => setAtivoProposto({...ativoProposto, prazo: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label">Alíquota IR (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="22.5"
                        value={ativoProposto.aliquotaIR}
                        onChange={(e) => setAtivoProposto({...ativoProposto, aliquotaIR: parseFloat(e.target.value) || 0})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="horizonte-info">
                    <div className="info-item">
                      <span className="info-label">Horizonte de Análise:</span>
                      <span className="info-value">{horizonte} anos</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Reinvestimento:</span>
                      <span className="info-value">CDI 100% após vencimento</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="calculate-section">
              <button onClick={calcularAnalise} className="calculate-btn">
                Calcular Análise Comparativa
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
                  📊 Resumo Executivo
                </button>
                <button 
                  className={`tab ${abaAtiva === 'graficos' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('graficos')}
                >
                  📈 Evolução Patrimonial
                </button>
                <button 
                  className={`tab ${abaAtiva === 'montecarlo' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('montecarlo')}
                >
                  🎲 Análise de Risco
                </button>
                <button 
                  className={`tab ${abaAtiva === 'cenarios' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('cenarios')}
                >
                  🎯 Cenários Econômicos
                </button>
                <button 
                  className={`tab ${abaAtiva === 'relatorio' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('relatorio')}
                >
                  📝 Relatório Técnico
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="tab-content">
                {abaAtiva === 'resumo' && (
                  <div className="resumo-content">
                    <div className="metrics-grid">
                      <div className="metric-card">
                        <h4>Resultado Esperado</h4>
                        <div className="metric-value">{formatarValor(resultados.vantagem)}</div>
                        <div className="metric-label">Diferença em {horizonte} anos</div>
                      </div>
                      <div className="metric-card">
                        <h4>Vantagem Anualizada</h4>
                        <div className="metric-value">{formatarPercentual(resultados.vantagemAnualizada)}</div>
                        <div className="metric-label">Diferença percentual ao ano</div>
                      </div>
                      <div className="metric-card">
                        <h4>Taxa de Equilíbrio</h4>
                        <div className="metric-value">{formatarPercentual(breakeven)}</div>
                        <div className="metric-label">Breakeven do ativo proposto</div>
                      </div>
                      <div className="metric-card">
                        <h4>Estratégia Atual</h4>
                        <div className="metric-value">{formatarValor(resultados.valorFinalAtual)}</div>
                        <div className="metric-label">Valor final projetado</div>
                      </div>
                      <div className="metric-card">
                        <h4>Estratégia Proposta</h4>
                        <div className="metric-value">{formatarValor(resultados.valorFinalProposto)}</div>
                        <div className="metric-label">Valor final projetado</div>
                      </div>
                      {monteCarlo && (
                        <div className="metric-card">
                          <h4>Probabilidade de Resultado Positivo</h4>
                          <div className="metric-value">{formatarPercentual(monteCarlo.probabilidadeResultadoPositivo)}</div>
                          <div className="metric-label">Análise de risco (Monte Carlo)</div>
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
                          <Line type="monotone" dataKey="atual" stroke="#64748b" strokeWidth={3} name="Estratégia Atual" />
                          <Line type="monotone" dataKey="proposto" stroke="#3b82f6" strokeWidth={3} name="Estratégia Proposta" />
                          <ReferenceLine x={`Ano ${ativoAtual.prazo}`} stroke="#64748b" strokeDasharray="5 5" label="Vencimento Atual" />
                          <ReferenceLine x={`Ano ${ativoProposto.prazo}`} stroke="#3b82f6" strokeDasharray="5 5" label="Vencimento Proposto" />
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
                          <Line type="monotone" dataKey="atual" stroke="#64748b" strokeWidth={3} name="Estratégia Atual" />
                          <Line type="monotone" dataKey="proposto" stroke="#3b82f6" strokeWidth={3} name="Estratégia Proposta" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {abaAtiva === 'montecarlo' && monteCarlo && (
                  <div className="montecarlo-content">
                    <div className="montecarlo-intro">
                      <h3>🎲 Análise de Risco: Simulação de Monte Carlo</h3>
                      <p>
                        A simulação de Monte Carlo testa sua decisão de investimento em 10.000 cenários econômicos diferentes, 
                        considerando variações aleatórias nas premissas macroeconômicas. Esta análise revela não apenas o 
                        resultado mais provável, mas toda a distribuição de possibilidades, permitindo uma avaliação 
                        quantitativa do risco da estratégia.
                      </p>
                    </div>

                    <div className="montecarlo-stats">
                      <div className="stats-grid">
                        <div className="stat-item">
                          <h4>💰 Resultado Esperado</h4>
                          <div className="stat-value">{formatarValor(monteCarlo.media)}</div>
                          <div className="stat-desc">Média das simulações</div>
                        </div>
                        <div className="stat-item">
                          <h4>📊 Resultado Mediano</h4>
                          <div className="stat-value">{formatarValor(monteCarlo.mediana)}</div>
                          <div className="stat-desc">50% dos cenários</div>
                        </div>
                        <div className="stat-item">
                          <h4>📈 Probabilidade de Resultado Positivo</h4>
                          <div className="stat-value">{formatarPercentual(monteCarlo.probabilidadeResultadoPositivo)}</div>
                          <div className="stat-desc">Estratégia proposta melhor</div>
                        </div>
                        <div className="stat-item">
                          <h4>📉 Probabilidade de Resultado Negativo</h4>
                          <div className="stat-value">{formatarPercentual(monteCarlo.probabilidadeResultadoNegativo)}</div>
                          <div className="stat-desc">Estratégia atual melhor</div>
                        </div>
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
                            <Tooltip formatter={(value, name) => [value, 'Frequência']} />
                            <Bar dataKey="frequencia" fill="#64748b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="percentis-analysis">
                        <h4>📊 Análise de Percentis</h4>
                        <div className="percentis-table">
                          <div className="percentil-row">
                            <span className="percentil-label">5% (Cenário Adverso)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p5)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">25% (Cenário Conservador)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p25)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">50% (Cenário Base)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.mediana)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">75% (Cenário Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p75)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">95% (Cenário Muito Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p95)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="montecarlo-insights">
                      <div className="insight-section">
                        <h4>🔍 Interpretação dos Resultados</h4>
                        <p>
                          <strong>Análise de Probabilidade:</strong> Em {monteCarlo.probabilidadeResultadoPositivo.toFixed(0)}% dos cenários simulados, 
                          a estratégia proposta apresenta resultado superior à atual. O resultado esperado médio é de {formatarValor(monteCarlo.media)}.
                        </p>
                        <p>
                          <strong>Gestão de Risco:</strong> No cenário adverso (5% das simulações), o resultado pode ser 
                          {monteCarlo.percentis.p5 < 0 ? 'desfavorável' : 'favorável'} em até {formatarValor(Math.abs(monteCarlo.percentis.p5))}. 
                          No cenário otimista (5% das simulações), o resultado pode alcançar {formatarValor(monteCarlo.percentis.p95)}.
                        </p>
                        <p>
                          <strong>Recomendação Técnica:</strong> {monteCarlo.probabilidadeResultadoPositivo > 70 ? 
                            'A estratégia proposta apresenta alta probabilidade de resultado superior com risco controlado.' :
                            monteCarlo.probabilidadeResultadoPositivo > 50 ?
                            'A estratégia proposta tem probabilidade moderada de resultado superior. Avalie seu perfil de risco.' :
                            'A estratégia atual pode ser mais adequada considerando o nível de incerteza identificado.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {abaAtiva === 'cenarios' && cenarios && (
                  <div className="cenarios-content">
                    <div className="cenarios-intro">
                      <h3>🎯 Análise de Cenários Econômicos</h3>
                      <p>
                        Avaliação da estratégia em 4 cenários macroeconômicos distintos, com probabilidades baseadas 
                        em análises históricas da economia brasileira. Cada cenário testa como variações nas taxas 
                        de juros e inflação afetam o resultado da decisão de investimento.
                      </p>
                    </div>

                    <div className="cenarios-grid">
                      {cenarios.map((cenario, index) => (
                        <div key={index} className="cenario-card">
                          <div className="cenario-header">
                            <span className="cenario-emoji">{cenario.emoji}</span>
                            <div className="cenario-info">
                              <h4>{cenario.nome}</h4>
                              <p>{cenario.descricao}</p>
                              <span className="probabilidade">Probabilidade histórica: {cenario.probabilidade}%</span>
                            </div>
                          </div>
                          
                          <div className="cenario-metrics">
                            <div className="metric-row">
                              <span className="metric-label">CDI</span>
                              <span className="metric-value">{formatarPercentual(cenario.cdi)}</span>
                            </div>
                            <div className="metric-row">
                              <span className="metric-label">IPCA</span>
                              <span className="metric-value">{formatarPercentual(cenario.ipca)}</span>
                            </div>
                            <div className="metric-row">
                              <span className="metric-label">Resultado</span>
                              <span className="metric-value">{formatarValor(cenario.vantagem)}</span>
                            </div>
                            <div className="metric-row">
                              <span className="metric-label">Vantagem Anual</span>
                              <span className="metric-value">{formatarPercentual(cenario.vantagemAnualizada)}</span>
                            </div>
                            <div className="metric-row">
                              <span className="metric-label">Impacto</span>
                              <span className="metric-value">{cenario.impacto}</span>
                            </div>
                          </div>

                          <div className="resultado-indicator">
                            <span className={`resultado-badge ${cenario.resultadoFavoravel ? 'positivo' : 'negativo'}`}>
                              {cenario.resultadoFavoravel ? 'Resultado Favorável' : 'Resultado Desfavorável'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="cenarios-summary">
                      <div className="summary-content">
                        <h4>📈 Síntese da Análise</h4>
                        <div className="summary-metrics">
                          <div className="summary-item">
                            <span className="summary-label">Cenários Favoráveis</span>
                            <span className="summary-value">
                              {cenarios.filter(c => c.resultadoFavoravel).length} de {cenarios.length}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Probabilidade Ponderada</span>
                            <span className="summary-value">
                              {formatarPercentual(
                                cenarios.reduce((acc, c) => acc + (c.resultadoFavoravel ? c.probabilidade : 0), 0)
                              )}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Cenário de Maior Risco</span>
                            <span className="summary-value">
                              {cenarios.find(c => c.impacto === 'Alto' && !c.resultadoFavoravel)?.nome || 'Baixo risco identificado'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="recommendation-box">
                          <h5>💡 Recomendação Estratégica</h5>
                          <p>
                            {cenarios.filter(c => c.resultadoFavoravel).length >= 3 ?
                              'A estratégia proposta demonstra robustez em múltiplos cenários econômicos, apresentando resultado superior na maioria das condições testadas.' :
                              cenarios.filter(c => c.resultadoFavoravel).length >= 2 ?
                              'A estratégia proposta apresenta resultados mistos nos cenários analisados. Recomenda-se avaliação detalhada do perfil de risco do investidor.' :
                              'A estratégia atual pode ser mais adequada considerando os riscos identificados nos cenários macroeconômicos testados.'
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
                      <h3>📝 Relatório Técnico de Análise Comparativa</h3>
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
                        considerando horizonte de investimento de {horizonte} anos e valor inicial de {formatarValor(ativoAtual.valorInvestido)}.
                      </p>

                      <p>
                        <strong>Resultados Determinísticos:</strong> Sob as premissas macroeconômicas estabelecidas 
                        (CDI iniciando em {formatarPercentual(premissas.cdi[0])} e IPCA em {formatarPercentual(premissas.ipca[0])}), 
                        a estratégia proposta apresenta resultado {resultados.vantagem > 0 ? 'superior' : 'inferior'} de {formatarValor(Math.abs(resultados.vantagem))} 
                        ({formatarPercentual(Math.abs(resultados.vantagemAnualizada))} ao ano) em relação à estratégia atual.
                      </p>

                      {monteCarlo && (
                        <p>
                          <strong>Análise de Risco (Monte Carlo):</strong> A simulação de 10.000 cenários revela 
                          probabilidade de resultado superior de {formatarPercentual(monteCarlo.probabilidadeResultadoPositivo)}, 
                          com expectativa de resultado médio de {formatarValor(monteCarlo.media)}. 
                          A análise de risco (VaR 95%) indica que, no cenário adverso (5% das simulações), 
                          o resultado pode ser desfavorável em até {formatarValor(Math.abs(monteCarlo.percentis.p5))}.
                        </p>
                      )}

                      {cenarios && (
                        <p>
                          <strong>Análise de Cenários:</strong> Dos {cenarios.length} cenários econômicos testados, 
                          {cenarios.filter(c => c.resultadoFavoravel).length} apresentam resultados favoráveis à migração. 
                          A probabilidade ponderada de resultado superior, considerando as probabilidades históricas de cada cenário, 
                          é de {formatarPercentual(cenarios.reduce((acc, c) => acc + (c.resultadoFavoravel ? c.probabilidade : 0), 0))}.
                        </p>
                      )}

                      <p>
                        <strong>Considerações sobre Reinvestimento:</strong> A análise considera reinvestimento 
                        {ativoAtual.prazo < ativoProposto.prazo ? 
                          `do ativo atual em ${ativoAtual.tipoReinvestimento.toUpperCase()} após ${ativoAtual.prazo} anos` :
                          `do ativo proposto em CDI após ${ativoProposto.prazo} anos`
                        } para equalizar o horizonte de investimento. As taxas de reinvestimento utilizadas refletem 
                        condições de mercado esperadas para o período.
                      </p>

                      <p>
                        <strong>Recomendação Técnica:</strong> {
                          resultados.vantagem > 0 && monteCarlo?.probabilidadeResultadoPositivo > 70 ?
                            'MIGRAR - A estratégia proposta apresenta resultado superior consistente com risco controlado.' :
                            resultados.vantagem > 0 && monteCarlo?.probabilidadeResultadoPositivo > 50 ?
                            'CONSIDERAR - A estratégia proposta oferece resultado superior, mas requer avaliação do perfil de risco.' :
                            'MANTER - A estratégia atual demonstra maior adequação ao cenário analisado.'
                        } A decisão final deve considerar o perfil de risco do investidor e objetivos específicos da carteira.
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

