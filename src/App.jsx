import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts';
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

// Função para simular Monte Carlo
const simularMonteCarlo = (ativoAtual, ativoProposto, premissas, horizonte) => {
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
    resultados.push(vantagem);
  }
  
  // Calcular estatísticas
  resultados.sort((a, b) => a - b);
  const media = resultados.reduce((sum, val) => sum + val, 0) / simulacoes;
  const desvio = Math.sqrt(resultados.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / simulacoes);
  const var95 = resultados[Math.floor(simulacoes * 0.05)];
  const probabilidadeSucesso = (resultados.filter(r => r > 0).length / simulacoes) * 100;
  
  // Gerar histograma
  const bins = 50;
  const minVal = Math.min(...resultados);
  const maxVal = Math.max(...resultados);
  const binSize = (maxVal - minVal) / bins;
  
  const histograma = [];
  for (let i = 0; i < bins; i++) {
    const binStart = minVal + i * binSize;
    const binEnd = binStart + binSize;
    const count = resultados.filter(r => r >= binStart && r < binEnd).length;
    
    // Calcular distribuição normal teórica
    const binCenter = binStart + binSize / 2;
    const normalValue = (1 / (desvio * Math.sqrt(2 * Math.PI))) * 
                       Math.exp(-0.5 * Math.pow((binCenter - media) / desvio, 2));
    
    histograma.push({
      bin: binCenter,
      frequencia: count,
      normal: normalValue * simulacoes * binSize,
      favoravel: binCenter > 0
    });
  }
  
  return {
    media,
    desvio,
    var95,
    probabilidadeSucesso,
    histograma,
    sharpeRatio: media / desvio
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

// Função para gerar análise de cenários
const gerarAnaliseCenarios = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const cenarios = [];
  const cdiBase = premissas.cdi[0];
  const ipcaBase = premissas.ipca[0];
  
  // Definir cenários econômicos específicos
  const cenariosPredefinidos = [
    { nome: "Atual", cdi: cdiBase, ipca: ipcaBase, descricao: "Premissas atuais" },
    { nome: "Otimista", cdi: cdiBase - 1, ipca: ipcaBase - 0.5, descricao: "Queda de juros e inflação controlada" },
    { nome: "Pessimista", cdi: cdiBase + 2, ipca: ipcaBase + 1.5, descricao: "Alta de juros e pressão inflacionária" },
    { nome: "Estagflação", cdi: cdiBase + 1, ipca: ipcaBase + 2, descricao: "Juros altos com inflação elevada" },
    { nome: "Deflação", cdi: cdiBase - 2, ipca: Math.max(0, ipcaBase - 1), descricao: "Queda acentuada de preços" }
  ];
  
  cenariosPredefinidos.forEach(cenario => {
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
    const vantagemPercentual = (vantagem / valorFinalAtual) * 100;
    const vantagemAnualizada = (Math.pow(valorFinalProposto / valorFinalAtual, 1/horizonte) - 1) * 100;

    cenarios.push({
      nome: cenario.nome,
      descricao: cenario.descricao,
      cdi: cenario.cdi,
      ipca: cenario.ipca,
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemPercentual,
      vantagemAnualizada,
      favoravel: vantagem > 0
    });
  });
  
  return cenarios;
};

// Função para gerar dados de heatmap
const gerarHeatmapSensibilidade = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const dadosHeatmap = [];
  const cdiBase = premissas.cdi[0];
  const ipcaBase = premissas.ipca[0];
  
  // Criar grid de variações
  const variacoesCDI = [-2, -1, 0, 1, 2];
  const variacoesIPCA = [-1, -0.5, 0, 0.5, 1];
  
  variacoesCDI.forEach(varCDI => {
    variacoesIPCA.forEach(varIPCA => {
      const premissasVariadas = {
        cdi: premissas.cdi.map(() => Math.max(0, cdiBase + varCDI)),
        ipca: premissas.ipca.map(() => Math.max(0, ipcaBase + varIPCA))
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

      dadosHeatmap.push({
        cdi: cdiBase + varCDI,
        ipca: ipcaBase + varIPCA,
        vantagem,
        vantagemAnualizada,
        favoravel: vantagem > 0
      });
    });
  });
  
  return dadosHeatmap;
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
  const [heatmap, setHeatmap] = useState(null);
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
    const resultadosMonteCarlo = simularMonteCarlo(ativoAtual, ativoProposto, premissas, horizonte);

    // Calcular breakeven
    const taxaBreakeven = calcularBreakeven(ativoAtual, ativoProposto, premissas, horizonte);

    // Gerar análise de cenários
    const analiseCenarios = gerarAnaliseCenarios(ativoAtual, ativoProposto, premissas, horizonte);
    
    // Gerar heatmap de sensibilidade
    const dadosHeatmap = gerarHeatmapSensibilidade(ativoAtual, ativoProposto, premissas, horizonte);

    setResultados({
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemPercentual,
      vantagemAnualizada,
      dadosEvolucao,
      dadosRentabilidade
    });

    setMonteCarlo(resultadosMonteCarlo);
    setBreakeven(taxaBreakeven);
    setCenarios(analiseCenarios);
    setHeatmap(dadosHeatmap);
  };

  // Função para gerar relatório CORRIGIDO
  const gerarRelatorio = () => {
    if (!resultados || !monteCarlo || !breakeven) return '';

    const tendencia = analisarTendenciaPremissas(premissas);
    const ativoMaisCurto = ativoAtual.prazo < ativoProposto.prazo ? 'atual' : 'proposto';
    const indexadorReinvestimento = ativoMaisCurto === 'atual' ? 
      `${ativoAtual.taxaReinvestimento}% do CDI` : 
      `${ativoProposto.indexador === 'ipca' ? 'IPCA+' : ativoProposto.indexador === 'pos' ? 'CDI' : 'Pré-fixado'}`;

    return `**RELATÓRIO DE ANÁLISE DE INVESTIMENTO**

**RESUMO EXECUTIVO**

Com base nas premissas macroeconômicas ${tendencia === 'otimista' ? 'favoráveis' : tendencia === 'pessimista' ? 'desafiadoras' : 'moderadas'} projetadas para os próximos ${horizonte} anos, nossa análise indica que a estratégia proposta apresenta ${resultados.vantagem > 0 ? 'vantagem' : 'desvantagem'} de ${formatarValorCompleto(Math.abs(resultados.vantagem))} em relação à estratégia atual.

**ESTRATÉGIAS COMPARADAS**

Estratégia Atual: ${getIndexadorNome(ativoAtual.indexador, ativoAtual.taxa)} por ${ativoAtual.prazo} anos${ativoMaisCurto === 'atual' ? `, com reinvestimento em ${indexadorReinvestimento}` : ''}
Valor Final: ${formatarValorCompleto(resultados.valorFinalAtual)}

Estratégia Proposta: ${getIndexadorNome(ativoProposto.indexador, ativoProposto.taxa)} por ${ativoProposto.prazo} anos${ativoMaisCurto === 'proposto' ? `, com reinvestimento em ${indexadorReinvestimento}` : ''}
Valor Final: ${formatarValorCompleto(resultados.valorFinalProposto)}

**ANÁLISE DE RISCO (MONTE CARLO)**

Nossa simulação de 10.000 cenários econômicos revela:
- Probabilidade de sucesso: ${monteCarlo.probabilidadeSucesso.toFixed(1)}%
- Vantagem média esperada: ${formatarValorCompleto(monteCarlo.media)}
- Pior cenário (VaR 95%): ${formatarValorCompleto(monteCarlo.var95)}
- Índice de Sharpe: ${monteCarlo.sharpeRatio.toFixed(2)}

**PONTO DE EQUILÍBRIO**

Para que ambas as estratégias apresentem resultados equivalentes, a estratégia proposta precisaria render ${breakeven.toFixed(2)}% ${ativoProposto.indexador === 'ipca' ? 'acima do IPCA' : ativoProposto.indexador === 'pos' ? 'do CDI' : 'ao ano'}.

**RECOMENDAÇÃO**

${resultados.vantagem > 50000 ? 
  `**MIGRAR**: A vantagem de ${formatarValorCompleto(resultados.vantagem)} (${resultados.vantagemAnualizada.toFixed(2)}% a.a.) justifica a migração, especialmente considerando a probabilidade de sucesso de ${monteCarlo.probabilidadeSucesso.toFixed(1)}%.` :
  resultados.vantagem > -50000 ?
  `**CONSIDERAR**: A diferença de ${formatarValorCompleto(Math.abs(resultados.vantagem))} é marginal. Avalie outros fatores como liquidez e objetivos pessoais.` :
  `**MANTER**: A estratégia atual apresenta vantagem de ${formatarValorCompleto(Math.abs(resultados.vantagem))}. Recomendamos manter a posição atual.`}

*Análise baseada em premissas macroeconômicas e simulação estatística. Resultados passados não garantem performance futura.*`;
  };

  // Função para copiar relatório
  const copiarRelatorio = () => {
    navigator.clipboard.writeText(gerarRelatorio());
    alert('Relatório copiado para a área de transferência!');
  };

  // Funções auxiliares
  const formatarValorCompleto = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  };

  const formatarValorMilhoes = (valor) => {
    if (Math.abs(valor) >= 1000000) {
      return `R$ ${(valor / 1000000).toFixed(1)}M`;
    }
    return `R$ ${(valor / 1000).toFixed(0)}K`;
  };

  const formatarPercentual = (valor) => {
    return `${valor.toFixed(1)}%`;
  };

  const getIndexadorNome = (indexador, taxa) => {
    switch (indexador) {
      case 'pre': return `Pré-fixado ${taxa}%`;
      case 'pos': return `${taxa}% do CDI`;
      case 'ipca': return `IPCA+ ${taxa}%`;
      default: return 'N/A';
    }
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
          {/* Cards de Input PROFISSIONAIS */}
          <div className="input-cards-professional">
            {/* Card Premissas */}
            <div className="input-card-pro premissas-card">
              <div className="card-header">
                <h3>📊 Premissas Macroeconômicas</h3>
                <span className="card-subtitle">Projeções anuais para o horizonte de análise</span>
              </div>
              <div className="premissas-grid">
                <div className="premissa-section">
                  <label className="premissa-title">Taxa CDI (%)</label>
                  <div className="premissa-inputs-row">
                    {premissas.cdi.map((valor, index) => (
                      <div key={index} className="input-group-micro">
                        <input
                          type="number"
                          step="0.1"
                          value={valor}
                          onChange={(e) => {
                            const novasCDI = [...premissas.cdi];
                            novasCDI[index] = parseFloat(e.target.value) || 0;
                            setPremissas({...premissas, cdi: novasCDI});
                          }}
                          className="input-professional"
                        />
                        <label className="input-label">Ano {index + 1}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="premissa-section">
                  <label className="premissa-title">IPCA (%)</label>
                  <div className="premissa-inputs-row">
                    {premissas.ipca.map((valor, index) => (
                      <div key={index} className="input-group-micro">
                        <input
                          type="number"
                          step="0.1"
                          value={valor}
                          onChange={(e) => {
                            const novasIPCA = [...premissas.ipca];
                            novasIPCA[index] = parseFloat(e.target.value) || 0;
                            setPremissas({...premissas, ipca: novasIPCA});
                          }}
                          className="input-professional"
                        />
                        <label className="input-label">Ano {index + 1}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Ativo Atual */}
            <div className="input-card-pro ativo-atual-card">
              <div className="card-header">
                <h3>🔵 Ativo Atual</h3>
                <span className="card-subtitle">Investimento que você possui hoje</span>
              </div>
              <div className="ativo-form">
                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Indexador</label>
                    <select
                      value={ativoAtual.indexador}
                      onChange={(e) => setAtivoAtual({...ativoAtual, indexador: e.target.value})}
                      className="input-professional"
                    >
                      <option value="pre">Pré-fixado</option>
                      <option value="pos">Pós-fixado</option>
                      <option value="ipca">IPCA+</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Taxa (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ativoAtual.taxa}
                      onChange={(e) => setAtivoAtual({...ativoAtual, taxa: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Prazo (anos)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={ativoAtual.prazo}
                      onChange={(e) => setAtivoAtual({...ativoAtual, prazo: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Valor Investido (R$)</label>
                    <input
                      type="number"
                      step="1000"
                      value={ativoAtual.valorInvestido}
                      onChange={(e) => setAtivoAtual({...ativoAtual, valorInvestido: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Alíquota IR (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="22.5"
                      value={ativoAtual.aliquotaIR}
                      onChange={(e) => setAtivoAtual({...ativoAtual, aliquotaIR: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                </div>
                
                <div className="reinvestimento-section">
                  <label className="section-title">Reinvestimento após vencimento</label>
                  <div className="reinvest-grid">
                    <div className="reinvest-option">
                      <input
                        type="radio"
                        id="reinvest-cdi"
                        name="reinvestimento"
                        value="cdi"
                        checked={ativoAtual.tipoReinvestimento === 'cdi'}
                        onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                      />
                      <label htmlFor="reinvest-cdi" className="radio-label">CDI</label>
                      <input
                        type="number"
                        step="1"
                        value={ativoAtual.taxaReinvestimentoCDI || 100}
                        onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoCDI: parseFloat(e.target.value) || 100})}
                        className="input-professional input-small"
                        disabled={ativoAtual.tipoReinvestimento !== 'cdi'}
                      />
                      <span className="unit">%</span>
                    </div>
                    <div className="reinvest-option">
                      <input
                        type="radio"
                        id="reinvest-ipca"
                        name="reinvestimento"
                        value="ipca"
                        checked={ativoAtual.tipoReinvestimento === 'ipca'}
                        onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                      />
                      <label htmlFor="reinvest-ipca" className="radio-label">IPCA+</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ativoAtual.taxaReinvestimentoIPCA || 6}
                        onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoIPCA: parseFloat(e.target.value) || 6})}
                        className="input-professional input-small"
                        disabled={ativoAtual.tipoReinvestimento !== 'ipca'}
                      />
                      <span className="unit">%</span>
                    </div>
                    <div className="reinvest-option">
                      <input
                        type="radio"
                        id="reinvest-pre"
                        name="reinvestimento"
                        value="pre"
                        checked={ativoAtual.tipoReinvestimento === 'pre'}
                        onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                      />
                      <label htmlFor="reinvest-pre" className="radio-label">Pré</label>
                      <input
                        type="number"
                        step="0.1"
                        value={ativoAtual.taxaReinvestimentoPre || 12}
                        onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimentoPre: parseFloat(e.target.value) || 12})}
                        className="input-professional input-small"
                        disabled={ativoAtual.tipoReinvestimento !== 'pre'}
                      />
                      <span className="unit">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Ativo Proposto */}
            <div className="input-card-pro ativo-proposto-card">
              <div className="card-header">
                <h3>🔷 Ativo Proposto</h3>
                <span className="card-subtitle">Nova oportunidade de investimento</span>
              </div>
              <div className="ativo-form">
                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Indexador</label>
                    <select
                      value={ativoProposto.indexador}
                      onChange={(e) => setAtivoProposto({...ativoProposto, indexador: e.target.value})}
                      className="input-professional"
                    >
                      <option value="pre">Pré-fixado</option>
                      <option value="pos">Pós-fixado</option>
                      <option value="ipca">IPCA+</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Taxa (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ativoProposto.taxa}
                      onChange={(e) => setAtivoProposto({...ativoProposto, taxa: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Prazo (anos)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={ativoProposto.prazo}
                      onChange={(e) => setAtivoProposto({...ativoProposto, prazo: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="input-group">
                    <label className="input-label">Alíquota IR (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="22.5"
                      value={ativoProposto.aliquotaIR}
                      onChange={(e) => setAtivoProposto({...ativoProposto, aliquotaIR: parseFloat(e.target.value) || 0})}
                      className="input-professional"
                    />
                  </div>
                  <div className="input-group">
                    <div className="horizonte-info">
                      <label className="input-label">Horizonte de Análise</label>
                      <div className="horizonte-value">{horizonte} anos</div>
                      <span className="horizonte-desc">Maior prazo entre os ativos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="calculate-section">
            <button onClick={calcularAnalise} className="calculate-button">
              Calcular Análise
            </button>
          </div>
        </div>

        {/* Resultados */}
        {resultados && (
          <div className="results-section">
            {/* Abas MELHORADAS */}
            <div className="tabs">
              <button
                className={`tab ${abaAtiva === 'resumo' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('resumo')}
              >
                <span className="tab-icon">📊</span>
                <span className="tab-text">Resumo Executivo</span>
              </button>
              <button
                className={`tab ${abaAtiva === 'graficos' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('graficos')}
              >
                <span className="tab-icon">📈</span>
                <span className="tab-text">Gráficos</span>
              </button>
              <button
                className={`tab ${abaAtiva === 'montecarlo' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('montecarlo')}
              >
                <span className="tab-icon">🎲</span>
                <span className="tab-text">Monte Carlo</span>
              </button>
              <button
                className={`tab ${abaAtiva === 'cenarios' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('cenarios')}
              >
                <span className="tab-icon">🎯</span>
                <span className="tab-text">Cenários</span>
              </button>
              <button
                className={`tab ${abaAtiva === 'relatorio' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('relatorio')}
              >
                <span className="tab-icon">📄</span>
                <span className="tab-text">Relatório</span>
              </button>
            </div>

            {/* Conteúdo das Abas */}
            <div className="tab-content">
              {abaAtiva === 'resumo' && (
                <div className="resumo-content">
                  <h3>Resumo Executivo</h3>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <h4>Estratégia Atual</h4>
                      <p className="metric-value">{formatarValorCompleto(resultados.valorFinalAtual)}</p>
                      <p className="metric-label">{getIndexadorNome(ativoAtual.indexador, ativoAtual.taxa)}</p>
                    </div>
                    <div className="metric-card">
                      <h4>Estratégia Proposta</h4>
                      <p className="metric-value">{formatarValorCompleto(resultados.valorFinalProposto)}</p>
                      <p className="metric-label">{getIndexadorNome(ativoProposto.indexador, ativoProposto.taxa)}</p>
                    </div>
                    <div className={`metric-card ${resultados.vantagem > 0 ? 'positive' : 'negative'}`}>
                      <h4>Vantagem</h4>
                      <p className="metric-value">{formatarValorCompleto(resultados.vantagem)}</p>
                      <p className="metric-label">{resultados.vantagemAnualizada.toFixed(2)}% a.a.</p>
                    </div>
                    {breakeven && (
                      <div className="metric-card breakeven">
                        <h4>Taxa de Breakeven</h4>
                        <p className="metric-value">{breakeven.toFixed(2)}%</p>
                        <p className="metric-label">
                          {breakeven > ativoProposto.taxa ? 
                            `${(breakeven - ativoProposto.taxa).toFixed(2)} p.p. acima` : 
                            `${(ativoProposto.taxa - breakeven).toFixed(2)} p.p. de margem`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {abaAtiva === 'graficos' && (
                <div className="graficos-content">
                  <h3>Análise Gráfica</h3>
                  
                  <div className="chart-container">
                    <h4>Evolução Patrimonial</h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={resultados.dadosEvolucao}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="ano" stroke="#64748b" fontSize={12} />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={formatarValorMilhoes}
                          domain={['dataMin * 0.95', 'dataMax * 1.05']}
                          width={80}
                        />
                        <Tooltip 
                          formatter={(value, name) => [formatarValorCompleto(value), name === 'atual' ? 'Estratégia Atual' : 'Estratégia Proposta']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="atual" 
                          stroke="#ef4444" 
                          strokeWidth={3}
                          name="Estratégia Atual"
                          dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="proposto" 
                          stroke="#22c55e" 
                          strokeWidth={3}
                          name="Estratégia Proposta"
                          dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                        />
                        <ReferenceLine 
                          x={`Ano ${ativoAtual.prazo}`} 
                          stroke="#f59e0b" 
                          strokeDasharray="5 5"
                          label={{ value: "Vencimento Atual", position: "topLeft", fontSize: 11 }}
                        />
                        <ReferenceLine 
                          x={`Ano ${ativoProposto.prazo}`} 
                          stroke="#8b5cf6" 
                          strokeDasharray="5 5"
                          label={{ value: "Vencimento Proposto", position: "topRight", fontSize: 11 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-container">
                    <h4>Rentabilidade Anualizada Acumulada</h4>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={resultados.dadosRentabilidade}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="ano" stroke="#64748b" fontSize={12} />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={formatarPercentual}
                          domain={['dataMin * 0.95', 'dataMax * 1.05']}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value, name) => [`${value.toFixed(2)}%`, name === 'atual' ? 'Estratégia Atual' : 'Estratégia Proposta']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="atual" 
                          stroke="#ef4444" 
                          strokeWidth={3}
                          name="Estratégia Atual"
                          dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="proposto" 
                          stroke="#22c55e" 
                          strokeWidth={3}
                          name="Estratégia Proposta"
                          dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {abaAtiva === 'montecarlo' && monteCarlo && (
                <div className="montecarlo-content">
                  <h3>Análise Monte Carlo</h3>
                  
                  <div className="monte-carlo-stats">
                    <div className="stat-card">
                      <h4>Probabilidade de Sucesso</h4>
                      <p className="stat-value">{monteCarlo.probabilidadeSucesso.toFixed(1)}%</p>
                    </div>
                    <div className="stat-card">
                      <h4>Vantagem Média</h4>
                      <p className="stat-value">{formatarValorCompleto(monteCarlo.media)}</p>
                    </div>
                    <div className="stat-card">
                      <h4>VaR 95%</h4>
                      <p className="stat-value">{formatarValorCompleto(monteCarlo.var95)}</p>
                    </div>
                    <div className="stat-card">
                      <h4>Índice Sharpe</h4>
                      <p className="stat-value">{monteCarlo.sharpeRatio.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="chart-container">
                    <h4>Distribuição de Resultados (10.000 simulações)</h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monteCarlo.histograma}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="bin" 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={formatarValorMilhoes}
                        />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'frequencia' ? `${value} simulações` : value.toFixed(0),
                            name === 'frequencia' ? 'Frequência Observada' : 'Distribuição Normal'
                          ]}
                          labelFormatter={(value) => `Vantagem: ${formatarValorCompleto(value)}`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Bar 
                          dataKey="frequencia" 
                          fill={(entry) => entry?.favoravel ? '#22c55e' : '#ef4444'}
                          name="Frequência"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="normal" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          name="Distribuição Normal"
                          dot={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="monte-carlo-explanation">
                    <h4>📚 Entendendo a Simulação Monte Carlo</h4>
                    <p>
                      A análise Monte Carlo simula 10.000 cenários econômicos diferentes, variando aleatoriamente 
                      as taxas de CDI e IPCA dentro de faixas históricas realistas. Isso nos permite entender 
                      não apenas o resultado esperado, mas também a probabilidade e magnitude de diferentes desfechos.
                    </p>
                    
                    <div className="interpretation-cards">
                      <div className="interpretation-card">
                        <h5>🎯 Probabilidade de Sucesso: {monteCarlo.probabilidadeSucesso.toFixed(1)}%</h5>
                        <p>
                          {monteCarlo.probabilidadeSucesso >= 70 ? 
                            'Alta probabilidade. A estratégia proposta supera a atual na maioria dos cenários econômicos.' :
                            monteCarlo.probabilidadeSucesso >= 50 ?
                            'Probabilidade moderada. O resultado depende significativamente do cenário econômico.' :
                            'Baixa probabilidade. A estratégia atual tende a ser superior na maioria dos cenários.'}
                        </p>
                      </div>
                      
                      <div className="interpretation-card">
                        <h5>📊 VaR 95%: {formatarValorCompleto(monteCarlo.var95)}</h5>
                        <p>
                          Em 95% dos cenários, sua {monteCarlo.var95 > 0 ? 'vantagem' : 'perda'} será superior a este valor. 
                          Este é o "pior caso" estatisticamente esperado, útil para avaliar o risco máximo da estratégia.
                        </p>
                      </div>
                      
                      <div className="interpretation-card">
                        <h5>⚖️ Índice Sharpe: {monteCarlo.sharpeRatio.toFixed(2)}</h5>
                        <p>
                          {monteCarlo.sharpeRatio > 1 ? 
                            'Excelente relação risco-retorno. A vantagem esperada compensa bem a volatilidade.' :
                            monteCarlo.sharpeRatio > 0.5 ?
                            'Boa relação risco-retorno. Vantagem esperada adequada para o risco assumido.' :
                            'Relação risco-retorno questionável. Alto risco para a vantagem esperada.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 'cenarios' && cenarios && heatmap && (
                <div className="cenarios-content">
                  <h3>Análise de Cenários Econômicos</h3>
                  
                  {/* Tabela de Cenários */}
                  <div className="cenarios-table-container">
                    <h4>Resultados por Cenário</h4>
                    <div className="cenarios-table">
                      <div className="table-header">
                        <div>Cenário</div>
                        <div>CDI</div>
                        <div>IPCA</div>
                        <div>Vantagem</div>
                        <div>Anualizada</div>
                        <div>Status</div>
                      </div>
                      {cenarios.map((cenario, index) => (
                        <div key={index} className={`table-row ${cenario.favoravel ? 'favoravel' : 'desfavoravel'}`}>
                          <div className="cenario-nome">
                            <strong>{cenario.nome}</strong>
                            <span className="cenario-desc">{cenario.descricao}</span>
                          </div>
                          <div>{cenario.cdi.toFixed(1)}%</div>
                          <div>{cenario.ipca.toFixed(1)}%</div>
                          <div>{formatarValorCompleto(cenario.vantagem)}</div>
                          <div>{cenario.vantagemAnualizada.toFixed(2)}% a.a.</div>
                          <div className={`status ${cenario.favoravel ? 'favoravel' : 'desfavoravel'}`}>
                            {cenario.favoravel ? '✅ Favorável' : '❌ Desfavorável'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Heatmap Visual */}
                  <div className="heatmap-container">
                    <h4>Mapa de Sensibilidade (CDI vs IPCA)</h4>
                    <div className="heatmap-grid">
                      <div className="heatmap-labels-y">
                        <div className="label-title">IPCA</div>
                        {[1, 0.5, 0, -0.5, -1].map(val => (
                          <div key={val} className="label-y">
                            {(premissas.ipca[0] + val).toFixed(1)}%
                          </div>
                        ))}
                      </div>
                      <div className="heatmap-main">
                        <div className="heatmap-labels-x">
                          {[-2, -1, 0, 1, 2].map(val => (
                            <div key={val} className="label-x">
                              {(premissas.cdi[0] + val).toFixed(1)}%
                            </div>
                          ))}
                        </div>
                        <div className="heatmap-cells">
                          {[1, 0.5, 0, -0.5, -1].map(ipcaVar => (
                            <div key={ipcaVar} className="heatmap-row">
                              {[-2, -1, 0, 1, 2].map(cdiVar => {
                                const cell = heatmap.find(h => 
                                  Math.abs(h.cdi - (premissas.cdi[0] + cdiVar)) < 0.1 && 
                                  Math.abs(h.ipca - (premissas.ipca[0] + ipcaVar)) < 0.1
                                );
                                const intensity = cell ? Math.abs(cell.vantagemAnualizada) / 5 : 0;
                                const isPositive = cell ? cell.favoravel : false;
                                return (
                                  <div 
                                    key={`${cdiVar}-${ipcaVar}`}
                                    className={`heatmap-cell ${isPositive ? 'positive' : 'negative'}`}
                                    style={{
                                      opacity: Math.min(0.3 + intensity * 0.7, 1)
                                    }}
                                    title={cell ? `Vantagem: ${cell.vantagemAnualizada.toFixed(2)}% a.a.` : ''}
                                  >
                                    {cell ? cell.vantagemAnualizada.toFixed(1) : '0.0'}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        <div className="heatmap-labels-x-title">CDI</div>
                      </div>
                    </div>
                    <div className="heatmap-legend">
                      <div className="legend-item">
                        <div className="legend-color positive"></div>
                        <span>Estratégia Proposta Favorável</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color negative"></div>
                        <span>Estratégia Atual Favorável</span>
                      </div>
                    </div>
                  </div>

                  {/* Análise Baseada nos Dados */}
                  <div className="cenarios-analysis">
                    <div className="analysis-section">
                      <h4>📊 Interpretação dos Resultados</h4>
                      <div className="analysis-grid">
                        <div className="analysis-card">
                          <h5>Cenários Favoráveis</h5>
                          <p className="analysis-number">
                            {cenarios.filter(c => c.favoravel).length} de {cenarios.length} cenários
                          </p>
                          <p className="analysis-desc">
                            {cenarios.filter(c => c.favoravel).length >= 3 ? 
                              'Estratégia robusta na maioria dos cenários' : 
                              'Estratégia sensível a mudanças econômicas'}
                          </p>
                        </div>
                        <div className="analysis-card">
                          <h5>Melhor Cenário</h5>
                          <p className="analysis-number">
                            {formatarValorCompleto(Math.max(...cenarios.map(c => c.vantagem)))}
                          </p>
                          <p className="analysis-desc">
                            {cenarios.find(c => c.vantagem === Math.max(...cenarios.map(c => c.vantagem)))?.nome}
                          </p>
                        </div>
                        <div className="analysis-card">
                          <h5>Pior Cenário</h5>
                          <p className="analysis-number">
                            {formatarValorCompleto(Math.min(...cenarios.map(c => c.vantagem)))}
                          </p>
                          <p className="analysis-desc">
                            {cenarios.find(c => c.vantagem === Math.min(...cenarios.map(c => c.vantagem)))?.nome}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="analysis-section">
                      <h4>🎯 Análise de Timing e Impacto</h4>
                      <div className="timing-analysis">
                        <div className="timing-card">
                          <h5>📈 Trajetória das Premissas</h5>
                          <div className="trajectory-info">
                            <div className="trajectory-item">
                              <span className="trajectory-label">CDI:</span>
                              <span className="trajectory-values">
                                {premissas.cdi[0].toFixed(1)}% → {premissas.cdi[premissas.cdi.length-1].toFixed(1)}%
                              </span>
                              <span className="trajectory-trend">
                                {premissas.cdi[0] > premissas.cdi[premissas.cdi.length-1] ? '📉 Queda gradual' : 
                                 premissas.cdi[0] < premissas.cdi[premissas.cdi.length-1] ? '📈 Alta gradual' : '➡️ Estável'}
                              </span>
                            </div>
                            <div className="trajectory-item">
                              <span className="trajectory-label">IPCA:</span>
                              <span className="trajectory-values">
                                {premissas.ipca[0].toFixed(1)}% → {premissas.ipca[premissas.ipca.length-1].toFixed(1)}%
                              </span>
                              <span className="trajectory-trend">
                                {premissas.ipca[0] > premissas.ipca[premissas.ipca.length-1] ? '📉 Desinflação' : 
                                 premissas.ipca[0] < premissas.ipca[premissas.ipca.length-1] ? '📈 Pressão inflacionária' : '➡️ Estável'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="timing-card">
                          <h5>⏰ Impacto do Timing</h5>
                          <div className="timing-insights">
                            {ativoAtual.prazo < ativoProposto.prazo && (
                              <div className="timing-insight">
                                <strong>Reinvestimento no Ano {ativoAtual.prazo}:</strong>
                                <p>
                                  Quando seu ativo atual vencer, você reinvestirá em {ativoAtual.tipoReinvestimento === 'cdi' ? `${ativoAtual.taxaReinvestimentoCDI}% do CDI` : 
                                  ativoAtual.tipoReinvestimento === 'ipca' ? `IPCA+ ${ativoAtual.taxaReinvestimentoIPCA}%` : 
                                  `Pré-fixado ${ativoAtual.taxaReinvestimentoPre}%`}.
                                  Neste momento, o CDI estará em {premissas.cdi[Math.min(ativoAtual.prazo-1, premissas.cdi.length-1)].toFixed(1)}% 
                                  e o IPCA em {premissas.ipca[Math.min(ativoAtual.prazo-1, premissas.ipca.length-1)].toFixed(1)}%.
                                </p>
                              </div>
                            )}
                            
                            <div className="timing-insight">
                              <strong>Cenário de Queda de Juros:</strong>
                              <p>
                                {premissas.cdi[0] > premissas.cdi[premissas.cdi.length-1] ? 
                                  `Com CDI caindo de ${premissas.cdi[0].toFixed(1)}% para ${premissas.cdi[premissas.cdi.length-1].toFixed(1)}%, ativos mais longos capturam taxas altas por mais tempo. ` +
                                  `O ativo de ${ativoProposto.prazo} anos se beneficia dessa trajetória descendente.` :
                                  `Com CDI subindo de ${premissas.cdi[0].toFixed(1)}% para ${premissas.cdi[premissas.cdi.length-1].toFixed(1)}%, ativos mais curtos permitem reinvestimento em taxas crescentes.`}
                              </p>
                            </div>

                            <div className="timing-insight">
                              <strong>Momento Crítico:</strong>
                              <p>
                                {Math.abs(premissas.cdi[0] - premissas.cdi[Math.floor(premissas.cdi.length/2)]) > 1 ?
                                  `A maior mudança de CDI ocorre entre os anos ${Math.floor(premissas.cdi.length/2)} e ${Math.floor(premissas.cdi.length/2)+1}, ` +
                                  `passando de ${premissas.cdi[Math.floor(premissas.cdi.length/2)-1].toFixed(1)}% para ${premissas.cdi[Math.floor(premissas.cdi.length/2)].toFixed(1)}%. ` +
                                  `Este é o período que mais impacta a comparação entre as estratégias.` :
                                  `As mudanças de CDI são graduais ao longo do horizonte, reduzindo o risco de timing na decisão.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="analysis-section">
                      <h4>📊 Resumo Executivo dos Cenários</h4>
                      <div className="executive-summary">
                        <div className="summary-metric">
                          <span className="metric-label">Cenários Favoráveis:</span>
                          <span className="metric-value">{cenarios.filter(c => c.favoravel).length}/{cenarios.length}</span>
                          <span className="metric-interpretation">
                            {cenarios.filter(c => c.favoravel).length >= 4 ? 'Estratégia robusta' : 
                             cenarios.filter(c => c.favoravel).length >= 3 ? 'Estratégia moderada' : 'Estratégia arriscada'}
                          </span>
                        </div>
                        <div className="summary-metric">
                          <span className="metric-label">Amplitude de Resultados:</span>
                          <span className="metric-value">
                            {formatarValorCompleto(Math.max(...cenarios.map(c => c.vantagem)) - Math.min(...cenarios.map(c => c.vantagem)))}
                          </span>
                          <span className="metric-interpretation">
                            {(Math.max(...cenarios.map(c => c.vantagem)) - Math.min(...cenarios.map(c => c.vantagem))) > 500000 ? 
                              'Alta sensibilidade econômica' : 'Baixa sensibilidade econômica'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {breakeven && (
                      <div className="analysis-section">
                        <h4>⚖️ Ponto de Equilíbrio</h4>
                        <p>
                          Considerando os cenários testados, sua estratégia proposta precisa render <strong>{breakeven.toFixed(2)}%</strong> para igualar a atual. 
                          {breakeven > ativoProposto.taxa ? 
                            ` Como a taxa atual é ${ativoProposto.taxa}%, você está ${(breakeven - ativoProposto.taxa).toFixed(2)} p.p. abaixo do necessário.` :
                            ` Como a taxa atual é ${ativoProposto.taxa}%, você tem uma margem de ${(ativoProposto.taxa - breakeven).toFixed(2)} p.p. de segurança.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {abaAtiva === 'relatorio' && (
                <div className="relatorio-content">
                  <div className="relatorio-header">
                    <h3>Relatório Completo para Cliente</h3>
                    <button onClick={copiarRelatorio} className="copy-button">
                      📋 Copiar Relatório
                    </button>
                  </div>
                  
                  <div className="relatorio-body">
                    <div dangerouslySetInnerHTML={{ 
                      __html: gerarRelatorio().replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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

