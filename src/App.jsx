import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area, ComposedChart } from 'recharts';
import './App.css';

// Função para calcular valor presente
const calcularValorPresente = (valorFuturo, premissasCDI, horizonte) => {
  let fatorDesconto = 1;
  
  for (let ano = 1; ano <= horizonte; ano++) {
    const cdiAno = premissasCDI[Math.min(ano - 1, premissasCDI.length - 1)];
    fatorDesconto *= (1 + cdiAno / 100);
  }
  
  return valorFuturo / fatorDesconto;
};

// Função para copiar gráfico como imagem
const copiarGrafico = async (chartId) => {
  try {
    const chartElement = document.getElementById(`chart-${chartId}`);
    if (!chartElement) return;
    
    // Usar html2canvas para capturar o gráfico
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    
    // Converter para blob e copiar
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Gráfico copiado! Cole no seu email ou documento.');
      } catch (err) {
        // Fallback: download da imagem
        const url = canvas.toDataURL();
        const link = document.createElement('a');
        link.download = `grafico-${chartId}.png`;
        link.href = url;
        link.click();
      }
    });
  } catch (error) {
    console.error('Erro ao copiar gráfico:', error);
    alert('Erro ao copiar gráfico. Tente novamente.');
  }
};

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

  // Percentis percentuais
  const percentisPercentuais = {
    p5: percentuais[Math.floor(simulacoes * 0.05)],
    p10: percentuais[Math.floor(simulacoes * 0.10)],
    p25: percentuais[Math.floor(simulacoes * 0.25)],
    p75: percentuais[Math.floor(simulacoes * 0.75)],
    p90: percentuais[Math.floor(simulacoes * 0.90)],
    p95: percentuais[Math.floor(simulacoes * 0.95)]
  };

  // Percentis anualizados
  const percentisAnualizados = {
    p5: (Math.pow(1 + percentisPercentuais.p5/100, 1/horizonte) - 1) * 100,
    p10: (Math.pow(1 + percentisPercentuais.p10/100, 1/horizonte) - 1) * 100,
    p25: (Math.pow(1 + percentisPercentuais.p25/100, 1/horizonte) - 1) * 100,
    p75: (Math.pow(1 + percentisPercentuais.p75/100, 1/horizonte) - 1) * 100,
    p90: (Math.pow(1 + percentisPercentuais.p90/100, 1/horizonte) - 1) * 100,
    p95: (Math.pow(1 + percentisPercentuais.p95/100, 1/horizonte) - 1) * 100
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
    percentisPercentuais,
    percentisAnualizados,
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

    const vantagemPercentual = valorPropostoAcum > 0 ? ((valorPropostoAcum - valorAtualAcum) / valorAtualAcum) * 100 : 0;
    
    dadosEvolucao.push({
      ano: `Ano ${ano}`,
      atual: valorAtualAcum,
      proposto: valorPropostoAcum,
      vantagemPercentual: vantagemPercentual,
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

// Função para gerar dados de análise de sensibilidade
const gerarDadosSensibilidade = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const dadosSensibilidade = [];
  const variacoes = [-3, -2, -1, 0, 1, 2, 3]; // Variações em pontos percentuais
  
  variacoes.forEach(variacao => {
    // Criar premissas modificadas
    const premissasModificadas = {
      cdi: premissas.cdi.map(taxa => Math.max(0, taxa + variacao)),
      ipca: premissas.ipca.map(taxa => Math.max(0, taxa + variacao))
    };
    
    const valorAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissasModificadas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      {
        cdi: ativoAtual.taxaReinvestimentoCDI || 100,
        ipca: ativoAtual.taxaReinvestimentoIPCA || 6,
        pre: ativoAtual.taxaReinvestimentoPre || 12
      },
      ativoAtual.aliquotaIR
    );

    const valorProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissasModificadas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );
    
    const vantagem = valorProposto - valorAtual;
    
    dadosSensibilidade.push({
      variacao: `${variacao >= 0 ? '+' : ''}${variacao}pp`,
      variacaoNum: variacao,
      vantagem: vantagem,
      atual: valorAtual,
      proposto: valorProposto
    });
  });
  
  return dadosSensibilidade;
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
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'R$ 0';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
};

const formatarValorMilhoes = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'R$ 0.0M';
  }
  if (Math.abs(valor) >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1)}M`;
  }
  return formatarValor(valor);
};

const formatarPercentual = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return '0.0%';
  }
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

    // Gerar dados de sensibilidade
    const dadosSensibilidade = gerarDadosSensibilidade(ativoAtual, ativoProposto, premissas, horizonte);

    // Calcular valor presente da vantagem
    const vantagemValorPresente = calcularValorPresente(vantagem, premissas.cdi, horizonte);

    setResultados({
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemValorPresente,
      vantagemPercentual,
      vantagemAnualizada,
      dadosEvolucao,
      dadosRentabilidade,
      dadosSensibilidade,
      tendencia: analisarTendenciaPremissas(premissas)
    });

    setMonteCarlo(resultadosMonteCarlo);
    setBreakeven(taxaBreakeven);
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
                  <h3>Premissas Macroeconômicas</h3>
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
                  <h3>Ativo Atual</h3>
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
                  <div className="form-row">
                    <div className="form-group">
                      <label className="input-label">Reinvestimento</label>
                      <select
                        value={ativoAtual.tipoReinvestimento || 'cdi'}
                        onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                        className="input-field"
                      >
                        <option value="cdi">CDI</option>
                        <option value="ipca">IPCA+</option>
                        <option value="pre">Pré-fixado</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="input-label">Taxa (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={
                          ativoAtual.tipoReinvestimento === 'cdi' ? (ativoAtual.taxaReinvestimentoCDI || 100) :
                          ativoAtual.tipoReinvestimento === 'ipca' ? (ativoAtual.taxaReinvestimentoIPCA || 6) :
                          (ativoAtual.taxaReinvestimentoPre || 12)
                        }
                        onChange={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          if (ativoAtual.tipoReinvestimento === 'cdi') {
                            setAtivoAtual({...ativoAtual, taxaReinvestimentoCDI: valor});
                          } else if (ativoAtual.tipoReinvestimento === 'ipca') {
                            setAtivoAtual({...ativoAtual, taxaReinvestimentoIPCA: valor});
                          } else {
                            setAtivoAtual({...ativoAtual, taxaReinvestimentoPre: valor});
                          }
                        }}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Ativo Proposto */}
              <div className="input-card">
                <div className="card-header">
                  <h3>Ativo Proposto</h3>
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
                  
                  {/* Botão de Calcular dentro do card */}
                  <div className="card-button-section">
                    <button onClick={calcularAnalise} className="calculate-btn-card">
                      Calcular Análise Comparativa
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {resultados && (
            <>
              {/* Abas */}
              <div className="tabs" style={{ marginTop: '1rem' }}>
                <button 
                  className={`tab ${abaAtiva === 'resumo' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('resumo')}
                >
                  Resumo Executivo
                </button>
                <button 
                  className={`tab ${abaAtiva === 'graficos' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('graficos')}
                >
                  Gráficos
                </button>
                <button 
                  className={`tab ${abaAtiva === 'montecarlo' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('montecarlo')}
                >
                  Análise de Risco
                </button>
                <button 
                  className={`tab ${abaAtiva === 'relatorio' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('relatorio')}
                >
                  Relatório Técnico
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
                        <h4>Valor Presente do Ganho</h4>
                        <div className="metric-value">{formatarValor(resultados.vantagemValorPresente)}</div>
                        <div className="metric-label">Valor presente da vantagem</div>
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
                    <div className="charts-grid-two">
                      {/* Gráfico 1 - Evolução do Patrimônio */}
                      <div className="chart-container">
                        <div className="chart-header">
                          <h4>Evolução do Patrimônio</h4>
                          <button 
                            className="copy-chart-btn"
                            onClick={() => copiarGrafico('evolucao')}
                            title="Copiar gráfico"
                          >
                            📋
                          </button>
                        </div>
                        <div id="chart-evolucao">
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={resultados.dadosEvolucao}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis 
                                dataKey="ano" 
                                tick={{ fontSize: 12 }}
                                axisLine={{ stroke: '#64748b' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                axisLine={{ stroke: '#64748b' }}
                                tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
                              />
                              <Tooltip 
                                formatter={(value, name) => [formatarValor(value), name]}
                                labelFormatter={(label) => `Ano ${label}`}
                                contentStyle={{
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="atual" 
                                stroke="#64748b" 
                                strokeWidth={3}
                                name="Estratégia Atual"
                                dot={{ fill: '#64748b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#64748b', strokeWidth: 2 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="proposto" 
                                stroke="#1e293b" 
                                strokeWidth={3}
                                name="Estratégia Proposta"
                                dot={{ fill: '#1e293b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#1e293b', strokeWidth: 2 }}
                              />
                              {/* Linha de vencimento do ativo atual */}
                              <ReferenceLine 
                                x={ativoAtual.prazo} 
                                stroke="#dc2626" 
                                strokeDasharray="5 5"
                                label={{ value: "Vencimento Ativo Atual", position: "top" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráfico 2 - Rentabilidade Anualizada */}
                      <div className="chart-container">
                        <div className="chart-header">
                          <h4>Rentabilidade Anualizada</h4>
                          <button 
                            className="copy-chart-btn"
                            onClick={() => copiarGrafico('rentabilidade')}
                            title="Copiar gráfico"
                          >
                            📋
                          </button>
                        </div>
                        <div id="chart-rentabilidade">
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={resultados.dadosRentabilidade}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis 
                                dataKey="ano" 
                                tick={{ fontSize: 12 }}
                                axisLine={{ stroke: '#64748b' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                axisLine={{ stroke: '#64748b' }}
                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                              />
                              <Tooltip 
                                formatter={(value, name) => [`${value.toFixed(2)}%`, name]}
                                labelFormatter={(label) => `Ano ${label}`}
                                contentStyle={{
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="atual" 
                                stroke="#64748b" 
                                strokeWidth={3}
                                name="Rentabilidade Atual"
                                dot={{ fill: '#64748b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#64748b', strokeWidth: 2 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="proposto" 
                                stroke="#1e293b" 
                                strokeWidth={3}
                                name="Rentabilidade Proposta"
                                dot={{ fill: '#1e293b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#1e293b', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {abaAtiva === 'montecarlo' && monteCarlo && (
                  <div className="montecarlo-content">
                    <div className="montecarlo-intro">
                      <h3>Análise de Risco: Simulação de Monte Carlo</h3>
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
                          <h4>Resultado Esperado</h4>
                          <div className="stat-value">{formatarValor(monteCarlo.media)}</div>
                          <div className="stat-desc">Média das simulações</div>
                        </div>
                        <div className="stat-item">
                          <h4>Resultado Mediano</h4>
                          <div className="stat-value">{formatarValor(monteCarlo.mediana)}</div>
                          <div className="stat-desc">50% dos cenários</div>
                        </div>
                        <div className="stat-item">
                          <h4>Probabilidade de Resultado Positivo</h4>
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
                        <h4>Análise de Percentis</h4>
                        <div className="percentis-table">
                          <div className="percentil-header">
                            <span className="percentil-label">Percentil</span>
                            <span className="percentil-value">Ganho Financeiro</span>
                            <span className="percentil-value">Ganho Percentual</span>
                            <span className="percentil-value">Ganho % Anualizado</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">5% (Cenário Adverso)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p5)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisPercentuais.p5)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisAnualizados.p5)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">25% (Cenário Conservador)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p25)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisPercentuais.p25)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisAnualizados.p25)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">50% (Cenário Base)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.mediana)}</span>
                            <span className="percentil-value">{formatarPercentual((monteCarlo.mediana / resultados.valorFinalAtual) * 100)}</span>
                            <span className="percentil-value">{formatarPercentual((Math.pow(1 + (monteCarlo.mediana / resultados.valorFinalAtual), 1/horizonte) - 1) * 100)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">75% (Cenário Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p75)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisPercentuais.p75)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisAnualizados.p75)}</span>
                          </div>
                          <div className="percentil-row">
                            <span className="percentil-label">95% (Cenário Muito Otimista)</span>
                            <span className="percentil-value">{formatarValor(monteCarlo.percentis.p95)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisPercentuais.p95)}</span>
                            <span className="percentil-value">{formatarPercentual(monteCarlo.percentisAnualizados.p95)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="montecarlo-insights">
                      <div className="insight-section">
                        <h4>🔍 Interpretação dos Resultados</h4>
                        <p>
                          <strong>Análise de Probabilidade:</strong> Em {(monteCarlo.probabilidadeResultadoPositivo || 0).toFixed(0)}% dos cenários simulados, 
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

                {abaAtiva === 'relatorio' && (
                  <div className="relatorio-content">
                    <div className="relatorio-header">
                      <h3>Relatório Técnico de Análise Comparativa</h3>
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
