import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area, ComposedChart } from 'recharts';
import './App.css';

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
const gerarCenariosEconomicos = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const cdiBase = premissas.cdi[0];
  const ipcaBase = premissas.ipca[0];
  
  const cenarios = [
    { 
      nome: "Conservador", 
      cdi: cdiBase - 1, 
      ipca: ipcaBase - 0.5, 
      descricao: "Economia estável, juros em queda",
      probabilidade: 30
    },
    { 
      nome: "Base", 
      cdi: cdiBase, 
      ipca: ipcaBase, 
      descricao: "Suas premissas atuais",
      probabilidade: 40
    },
    { 
      nome: "Stress", 
      cdi: cdiBase + 2, 
      ipca: ipcaBase + 1.5, 
      descricao: "Pressão inflacionária, alta de juros",
      probabilidade: 20
    },
    { 
      nome: "Adverso", 
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

// Função para gerar cenários de curva de juros dinâmicos
const gerarCenariosCurvaJuros = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const cenarios = [
    {
      id: 'base',
      nome: 'Cenário Base',
      descricao: 'Premissas atuais mantidas ao longo do horizonte',
      probabilidade: 25,
      movimento: 'Estável',
      timeline: 'Trajetória gradual conforme premissas inseridas',
      premissasModificadas: premissas,
      detalhesMovimento: {
        tipo: 'base',
        intensidade: 0,
        timing: 'N/A'
      }
    },
    {
      id: 'paralelo_alta',
      nome: 'Movimento Paralelo para Cima',
      descricao: 'Todos os vértices da curva sobem uniformemente devido a pressões inflacionárias',
      probabilidade: 20,
      movimento: 'Paralelo +200bps',
      timeline: 'Ano 1: +50bps, Ano 2: +100bps, Ano 3-4: +150bps, Ano 5+: +200bps',
      premissasModificadas: {
        cdi: premissas.cdi.map((taxa, i) => {
          const incremento = i === 0 ? 0.5 : i === 1 ? 1 : i <= 3 ? 1.5 : 2;
          return taxa + incremento;
        }),
        ipca: premissas.ipca.map((taxa, i) => {
          const incremento = i === 0 ? 0.3 : i === 1 ? 0.6 : i <= 3 ? 0.9 : 1.2;
          return taxa + incremento;
        })
      },
      detalhesMovimento: {
        tipo: 'paralelo',
        intensidade: 200,
        timing: 'Gradual ao longo de 5 anos',
        gatilhos: ['Pressão inflacionária persistente', 'Política fiscal expansionista', 'Choque de commodities']
      }
    },
    {
      id: 'paralelo_baixa',
      nome: 'Movimento Paralelo para Baixo',
      descricao: 'Todos os vértices da curva caem devido a desaceleração econômica',
      probabilidade: 20,
      movimento: 'Paralelo -150bps',
      timeline: 'Ano 1: -25bps, Ano 2: -75bps, Ano 3-4: -125bps, Ano 5+: -150bps',
      premissasModificadas: {
        cdi: premissas.cdi.map((taxa, i) => {
          const decremento = i === 0 ? 0.25 : i === 1 ? 0.75 : i <= 3 ? 1.25 : 1.5;
          return Math.max(2, taxa - decremento);
        }),
        ipca: premissas.ipca.map((taxa, i) => {
          const decremento = i === 0 ? 0.2 : i === 1 ? 0.5 : i <= 3 ? 0.8 : 1;
          return Math.max(1.5, taxa - decremento);
        })
      },
      detalhesMovimento: {
        tipo: 'paralelo',
        intensidade: -150,
        timing: 'Gradual ao longo de 5 anos',
        gatilhos: ['Recessão econômica', 'Desinflação estrutural', 'Política monetária acomodatícia']
      }
    },
    {
      id: 'steepening',
      nome: 'Steepening (Inclinação)',
      descricao: 'Curva se inclina: curto cai por cortes de juros, longo sobe por expectativas inflacionárias',
      probabilidade: 15,
      movimento: 'Curto -100bps, Longo +150bps',
      timeline: 'Ano 1-2: Divergência inicial, Ano 3-4: Máxima inclinação, Ano 5+: Estabilização',
      premissasModificadas: {
        cdi: premissas.cdi.map((taxa, i) => {
          if (i <= 1) return Math.max(2, taxa - 1); // Curto prazo cai
          if (i <= 3) return taxa + 0.5; // Médio prazo neutro
          return taxa + 1.5; // Longo prazo sobe
        }),
        ipca: premissas.ipca.map((taxa, i) => {
          if (i <= 1) return Math.max(1.5, taxa - 0.5);
          if (i <= 3) return taxa + 0.3;
          return taxa + 1;
        })
      },
      detalhesMovimento: {
        tipo: 'steepening',
        intensidade: 250, // Diferencial entre curto e longo
        timing: 'Divergência nos primeiros 2 anos, estabilização após',
        gatilhos: ['Cortes de juros no curto prazo', 'Expectativas inflacionárias de longo prazo', 'Política fiscal expansionista futura']
      }
    },
    {
      id: 'flattening',
      nome: 'Flattening (Achatamento)',
      descricao: 'Curva se achata: curto sobe por aperto monetário, longo cai por expectativas de recessão',
      probabilidade: 15,
      movimento: 'Curto +150bps, Longo -100bps',
      timeline: 'Ano 1-2: Convergência inicial, Ano 3-4: Máximo achatamento, Ano 5+: Normalização',
      premissasModificadas: {
        cdi: premissas.cdi.map((taxa, i) => {
          if (i <= 1) return taxa + 1.5; // Curto prazo sobe
          if (i <= 3) return taxa + 0.2; // Médio prazo neutro
          return Math.max(2, taxa - 1); // Longo prazo cai
        }),
        ipca: premissas.ipca.map((taxa, i) => {
          if (i <= 1) return taxa + 1;
          if (i <= 3) return taxa + 0.1;
          return Math.max(1.5, taxa - 0.5);
        })
      },
      detalhesMovimento: {
        tipo: 'flattening',
        intensidade: -250, // Diferencial negativo entre curto e longo
        timing: 'Convergência nos primeiros 2 anos, normalização gradual',
        gatilhos: ['Aperto monetário agressivo', 'Expectativas de recessão futura', 'Inversão de expectativas inflacionárias']
      }
    },
    {
      id: 'twist',
      nome: 'Twist (Torção)',
      descricao: 'Meio da curva se move diferente das pontas: barriga da curva sobe, pontas estáveis',
      probabilidade: 5,
      movimento: 'Pontas estáveis, Meio +100bps',
      timeline: 'Ano 1-3: Formação da torção, Ano 4-5: Manutenção, Ano 6+: Normalização',
      premissasModificadas: {
        cdi: premissas.cdi.map((taxa, i) => {
          if (i === 0 || i === 4) return taxa; // Pontas estáveis
          return taxa + 1; // Meio sobe
        }),
        ipca: premissas.ipca.map((taxa, i) => {
          if (i === 0 || i === 4) return taxa;
          return taxa + 0.6;
        })
      },
      detalhesMovimento: {
        tipo: 'twist',
        intensidade: 100,
        timing: 'Formação em 3 anos, manutenção por 2 anos',
        gatilhos: ['Operações de twist do Banco Central', 'Demanda específica por títulos de médio prazo', 'Arbitragem de duration']
      }
    }
  ];

  return cenarios.map(cenario => {
    // Identificar qual ativo vence primeiro para reinvestimento
    const ativoMaisCurto = ativoAtual.prazo < ativoProposto.prazo ? ativoAtual : ativoProposto;
    const taxasReinvestimento = ativoMaisCurto === ativoAtual ? 
      { cdi: ativoAtual.taxaReinvestimentoCDI || 100, ipca: ativoAtual.taxaReinvestimentoIPCA || 6, pre: ativoAtual.taxaReinvestimentoPre || 12 } :
      { cdi: 100, ipca: 6, pre: 12 };

    const valorFinalAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      cenario.premissasModificadas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      taxasReinvestimento,
      ativoAtual.aliquotaIR
    );

    const valorFinalProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      cenario.premissasModificadas,
      horizonte,
      'cdi',
      { cdi: 100, ipca: 6, pre: 12 },
      ativoProposto.aliquotaIR
    );

    const vantagem = valorFinalProposto - valorFinalAtual;
    const vantagemAnualizada = (Math.pow(valorFinalProposto / valorFinalAtual, 1/horizonte) - 1) * 100;

    // Análise de duração e convexidade
    const duracaoAtual = calcularDuracao(ativoAtual, cenario.premissasModificadas);
    const duracaoProposto = calcularDuracao(ativoProposto, cenario.premissasModificadas);
    
    // Análise de carry vs roll-down
    const carryAtual = calcularCarry(ativoAtual, cenario.premissasModificadas);
    const carryProposto = calcularCarry(ativoProposto, cenario.premissasModificadas);

    // Análise de timing de reinvestimento
    const momentoReinvestimento = ativoMaisCurto.prazo;
    const taxaReinvestimentoNoMomento = cenario.premissasModificadas.cdi[Math.min(momentoReinvestimento - 1, cenario.premissasModificadas.cdi.length - 1)];

    return {
      ...cenario,
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemAnualizada,
      resultadoFavoravel: vantagem > 0,
      impacto: Math.abs(vantagem) > 100000 ? 'Alto' : Math.abs(vantagem) > 50000 ? 'Médio' : 'Baixo',
      duracaoAtual,
      duracaoProposto,
      carryAtual,
      carryProposto,
      sensibilidadeJuros: Math.abs(duracaoAtual - duracaoProposto) > 1 ? 'Alta' : 'Moderada',
      momentoReinvestimento,
      taxaReinvestimentoNoMomento,
      impactoTiming: calcularImpactoTiming(cenario, ativoMaisCurto, horizonte)
    };
  });
};

// Função para calcular impacto do timing
const calcularImpactoTiming = (cenario, ativoMaisCurto, horizonte) => {
  const momentoReinvestimento = ativoMaisCurto.prazo;
  const taxaInicial = cenario.premissasModificadas.cdi[0];
  const taxaNoMomento = cenario.premissasModificadas.cdi[Math.min(momentoReinvestimento - 1, cenario.premissasModificadas.cdi.length - 1)];
  const taxaFinal = cenario.premissasModificadas.cdi[cenario.premissasModificadas.cdi.length - 1];
  
  const diferencaInicial = taxaNoMomento - taxaInicial;
  const diferencaFinal = taxaFinal - taxaNoMomento;
  
  return {
    momentoReinvestimento,
    taxaInicial,
    taxaNoMomento,
    taxaFinal,
    diferencaInicial,
    diferencaFinal,
    favorabilidade: diferencaFinal > 0 ? 'Favorável' : diferencaFinal < 0 ? 'Desfavorável' : 'Neutro'
  };
};

// Função para calcular duração modificada aproximada
const calcularDuracao = (ativo, premissas) => {
  if (ativo.indexador === 'pre') {
    return ativo.prazo * 0.9; // Aproximação para pré-fixado
  } else {
    return ativo.prazo * 0.3; // Aproximação para pós-fixado
  }
};

// Função para calcular carry anualizado
const calcularCarry = (ativo, premissas) => {
  const taxaMedia = premissas.cdi.reduce((a, b) => a + b, 0) / premissas.cdi.length;
  if (ativo.indexador === 'cdi') {
    return (ativo.taxa / 100) * taxaMedia;
  } else if (ativo.indexador === 'ipca') {
    const ipcaMedia = premissas.ipca.reduce((a, b) => a + b, 0) / premissas.ipca.length;
    return ativo.taxa + ipcaMedia;
  } else {
    return ativo.taxa;
  }
};

// Função para gerar dados de visualização da curva de juros
const gerarDadosCurvaJuros = (cenarios) => {
  const vertices = ['1A', '2A', '3A', '5A', '10A'];
  
  return cenarios.map(cenario => ({
    nome: cenario.nome,
    dados: vertices.map((vertice, i) => ({
      vertice,
      cdi: cenario.premissasModificadas.cdi[i] || cenario.premissasModificadas.cdi[cenario.premissasModificadas.cdi.length - 1],
      ipca: cenario.premissasModificadas.ipca[i] || cenario.premissasModificadas.ipca[cenario.premissasModificadas.ipca.length - 1]
    }))
  }));
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
  const [cenarios, setCenarios] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('resumo');

  // Estados do Laboratório Interativo
  const [cenarioSelecionado, setCenarioSelecionado] = useState('base');
  const [numSimulacoes, setNumSimulacoes] = useState(1000);
  const [modoComparacao, setModoComparacao] = useState('single');
  const [simulandoAtivo, setSimulandoAtivo] = useState(false);
  const [dadosLaboratorio, setDadosLaboratorio] = useState(null);

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

    // Gerar análise de cenários de curva de juros
    const cenariosCurva = gerarCenariosCurvaJuros(ativoAtual, ativoProposto, premissas, horizonte);
    const dadosCurvaJuros = gerarDadosCurvaJuros(cenariosCurva);

    // Gerar cenários
    const cenariosEconomicos = gerarCenariosEconomicos(ativoAtual, ativoProposto, premissas, horizonte);

    // Calcular breakeven
    const taxaBreakeven = calcularBreakeven(ativoAtual, ativoProposto, premissas, horizonte);

    // Gerar dados de sensibilidade
    const dadosSensibilidade = gerarDadosSensibilidade(ativoAtual, ativoProposto, premissas, horizonte);

    setResultados({
      valorFinalAtual,
      valorFinalProposto,
      vantagem,
      vantagemPercentual,
      vantagemAnualizada,
      dadosEvolucao,
      dadosRentabilidade,
      dadosSensibilidade,
      tendencia: analisarTendenciaPremissas(premissas)
    });

    setMonteCarlo(resultadosMonteCarlo);
    setBreakeven(taxaBreakeven);
    setCenarios({ economicos: cenariosEconomicos, curvaJuros: cenariosCurva, dadosCurva: dadosCurvaJuros });
  };

  // Cenários econômicos detalhados para o laboratório
  const cenariosLaboratorio = {
    base: {
      nome: "Cenário Base",
      probabilidade: 25,
      parametros: { pib: 2.5, ipca: 4.0, selic: 11.5, cambio: 5.2 },
      teorias: ["Curva de Phillips", "Regra de Taylor", "Expectativas Racionais"],
      fundamentacao: "Cenário de pouso suave da economia com convergência gradual da inflação para a meta e normalização da política monetária.",
      gatilhos: [
        "Consolidação fiscal em andamento",
        "Inflação convergindo para meta",
        "Mercado de trabalho equilibrado",
        "Política monetária restritiva eficaz"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "2016-2019", descricao: "Recuperação pós-recessão com inflação controlada" },
        { id: 2, pais: "Chile", periodo: "2010-2015", descricao: "Estabilização após crise com política monetária ativa" }
      ]
    },
    recessao: {
      nome: "Recessão Técnica",
      probabilidade: 15,
      parametros: { pib: -1.0, ipca: 3.5, selic: 9.0, cambio: 5.8 },
      teorias: ["Ciclos Econômicos", "Armadilha da Liquidez", "Multiplicador Fiscal"],
      fundamentacao: "Contração econômica temporária devido a choques externos ou aperto monetário excessivo, com resposta de política anticíclica.",
      gatilhos: [
        "Aperto monetário excessivo",
        "Choque de confiança empresarial",
        "Deterioração do cenário externo",
        "Contração do crédito"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "2014-2016", descricao: "Recessão com alta inflação e crise política" },
        { id: 2, pais: "EUA", periodo: "2001", descricao: "Recessão técnica pós-bolha tecnológica" }
      ]
    },
    estagflacao: {
      nome: "Estagflação",
      probabilidade: 10,
      parametros: { pib: 0.5, ipca: 7.0, selic: 14.0, cambio: 6.5 },
      teorias: ["Curva de Phillips", "Choque de Oferta", "Indexação de Preços"],
      fundamentacao: "Combinação de baixo crescimento com alta inflação, típica de choques de oferta ou desancoragem de expectativas.",
      gatilhos: [
        "Choque de commodities",
        "Desancoragem de expectativas",
        "Pressões de custos generalizadas",
        "Política fiscal expansionista"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "1970-1980", descricao: "Choques do petróleo com indexação generalizada" },
        { id: 2, pais: "EUA", periodo: "1970s", descricao: "Estagflação pós-choques do petróleo" }
      ]
    },
    boom: {
      nome: "Boom de Commodities",
      probabilidade: 12,
      parametros: { pib: 4.0, ipca: 5.5, selic: 13.0, cambio: 4.8 },
      teorias: ["Doença Holandesa", "Superciclo de Commodities", "Termos de Troca"],
      fundamentacao: "Ciclo expansivo impulsionado por alta dos preços de commodities, com pressões inflacionárias e apreciação cambial.",
      gatilhos: [
        "Alta global de commodities",
        "Demanda chinesa aquecida",
        "Restrições de oferta global",
        "Especulação financeira"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "2003-2008", descricao: "Boom das commodities com crescimento acelerado" },
        { id: 2, pais: "Austrália", periodo: "2005-2012", descricao: "Superciclo minerário com apreciação cambial" }
      ]
    },
    crise_fiscal: {
      nome: "Crise Fiscal",
      probabilidade: 8,
      parametros: { pib: -0.5, ipca: 6.0, selic: 15.0, cambio: 7.0 },
      teorias: ["Dominância Fiscal", "Equivalência Ricardiana", "Sustentabilidade da Dívida"],
      fundamentacao: "Deterioração das contas públicas gerando desconfiança sobre sustentabilidade fiscal e pressões sobre juros e câmbio.",
      gatilhos: [
        "Deterioração do resultado primário",
        "Alta da dívida/PIB",
        "Perda de credibilidade fiscal",
        "Pressão dos mercados"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "2014-2016", descricao: "Crise fiscal com recessão e alta inflação" },
        { id: 2, pais: "Argentina", periodo: "2018-2019", descricao: "Crise de confiança com fuga de capitais" }
      ]
    },
    choque_externo: {
      nome: "Choque Externo",
      probabilidade: 10,
      parametros: { pib: 1.0, ipca: 5.0, selic: 12.5, cambio: 6.2 },
      teorias: ["Paridade do Poder de Compra", "Mobilidade de Capitais", "Contágio Financeiro"],
      fundamentacao: "Turbulência externa afetando fluxos de capital e preços de ativos, com transmissão via câmbio e confiança.",
      gatilhos: [
        "Guerra comercial global",
        "Crise geopolítica",
        "Mudança na política do Fed",
        "Contágio de mercados emergentes"
      ],
      precedentes: [
        { id: 1, pais: "Brasil", periodo: "2008", descricao: "Crise financeira global com contágio via câmbio" },
        { id: 2, pais: "Turquia", periodo: "2018", descricao: "Crise cambial por tensões geopolíticas" }
      ]
    }
  };

  // Função para executar simulação do laboratório
  const executarSimulacao = async () => {
    if (!resultados) {
      alert('Execute primeiro uma análise comparativa!');
      return;
    }
    
    setSimulandoAtivo(true);
    
    // Simular delay para mostrar loading
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const cenarioInfo = cenariosLaboratorio[cenarioSelecionado];
      
      setDadosLaboratorio({
        cenario: cenarioInfo,
        simulacaoExecutada: true,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('Erro na simulação:', error);
      alert('Erro ao executar simulação. Tente novamente.');
    } finally {
      setSimulandoAtivo(false);
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
                  className={`tab ${abaAtiva === 'cenarios' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('cenarios')}
                >
                  Cenários Econômicos
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
                                dataKey="estrategiaAtual" 
                                stroke="#64748b" 
                                strokeWidth={3}
                                name="Estratégia Atual"
                                dot={{ fill: '#64748b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#64748b', strokeWidth: 2 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="estrategiaProposta" 
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
                                dataKey="rentabilidadeAtual" 
                                stroke="#64748b" 
                                strokeWidth={3}
                                name="Rentabilidade Atual"
                                dot={{ fill: '#64748b', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#64748b', strokeWidth: 2 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="rentabilidadeProposta" 
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

                {abaAtiva === 'cenarios' && (
                  <div className="laboratorio-content">
                    <div className="laboratorio-intro">
                      <h3>🎛️ Laboratório Interativo de Cenários</h3>
                      <p>
                        Simulação avançada com cenários econômicos fundamentados em teoria macroeconômica. 
                        Selecione um cenário para visualizar impactos específicos nos gráficos e análise detalhada.
                      </p>
                    </div>

                    <div className="lab-control-panel">
                      <div className="control-grid">
                        <div className="control-item">
                          <label>Cenário Econômico</label>
                          <select 
                            value={cenarioSelecionado} 
                            onChange={(e) => setCenarioSelecionado(e.target.value)}
                          >
                            <option value="base">Cenário Base (25%)</option>
                            <option value="recessao">Recessão Técnica (15%)</option>
                            <option value="estagflacao">Estagflação (10%)</option>
                            <option value="boom">Boom de Commodities (12%)</option>
                            <option value="crise_fiscal">Crise Fiscal (8%)</option>
                            <option value="choque_externo">Choque Externo (10%)</option>
                          </select>
                        </div>
                        
                        <div className="control-item">
                          <label>Simulações Monte Carlo</label>
                          <select 
                            value={numSimulacoes} 
                            onChange={(e) => setNumSimulacoes(parseInt(e.target.value))}
                          >
                            <option value="1000">1.000 simulações</option>
                            <option value="5000">5.000 simulações</option>
                            <option value="10000">10.000 simulações</option>
                          </select>
                        </div>
                        
                        <div className="control-item">
                          <label>Modo de Análise</label>
                          <select 
                            value={modoComparacao} 
                            onChange={(e) => setModoComparacao(e.target.value)}
                          >
                            <option value="single">Cenário Único</option>
                            <option value="dual">Comparação Dupla</option>
                            <option value="triple">Comparação Tripla</option>
                          </select>
                        </div>
                      </div>
                      
                      <button 
                        className="simulate-btn"
                        onClick={executarSimulacao}
                        disabled={simulandoAtivo}
                      >
                        {simulandoAtivo ? '⏳ Simulando...' : '▶️ Executar Simulação'}
                      </button>
                    </div>

                    {dadosLaboratorio ? (
                      <div className="lab-results">
                        <div className="scenario-analysis">
                          <h4>📊 Análise do Cenário: {dadosLaboratorio.cenario.nome}</h4>
                          
                          <div className="scenario-details">
                            <div className="scenario-card">
                              <h5>📚 Fundamentação Teórica</h5>
                              <div className="theory-tags">
                                {dadosLaboratorio.cenario.teorias.map((teoria, index) => (
                                  <span key={index} className="theory-tag">{teoria}</span>
                                ))}
                              </div>
                              <p>{dadosLaboratorio.cenario.fundamentacao}</p>
                            </div>

                            <div className="scenario-card">
                              <h5>⚡ Gatilhos Econômicos</h5>
                              <ul className="triggers-list">
                                {dadosLaboratorio.cenario.gatilhos.map((gatilho, index) => (
                                  <li key={index}>{gatilho}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="scenario-card">
                              <h5>📈 Parâmetros Macroeconômicos</h5>
                              <div className="params-grid">
                                <div className="param-item">
                                  <span className="param-label">PIB:</span>
                                  <span className="param-value">{dadosLaboratorio.cenario.parametros.pib}%</span>
                                </div>
                                <div className="param-item">
                                  <span className="param-label">IPCA:</span>
                                  <span className="param-value">{dadosLaboratorio.cenario.parametros.ipca}%</span>
                                </div>
                                <div className="param-item">
                                  <span className="param-label">Selic:</span>
                                  <span className="param-value">{dadosLaboratorio.cenario.parametros.selic}%</span>
                                </div>
                                <div className="param-item">
                                  <span className="param-label">Câmbio:</span>
                                  <span className="param-value">R$ {dadosLaboratorio.cenario.parametros.cambio}</span>
                                </div>
                              </div>
                            </div>

                            <div className="scenario-card">
                              <h5>🏛️ Precedentes Históricos</h5>
                              <div className="precedents-list">
                                {dadosLaboratorio.cenario.precedentes.map((precedente) => (
                                  <div key={precedente.id} className="precedent-item">
                                    <strong>{precedente.pais} ({precedente.periodo}):</strong>
                                    <span>{precedente.descricao}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="simulation-info">
                            <p><strong>Simulação executada:</strong> {dadosLaboratorio.timestamp}</p>
                            <p><strong>Número de simulações:</strong> {numSimulacoes.toLocaleString()}</p>
                            <p><strong>Probabilidade do cenário:</strong> {dadosLaboratorio.cenario.probabilidade}%</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="lab-placeholder">
                        <div className="placeholder-content">
                          <h4>🚀 Pronto para Simular</h4>
                          <p>
                            Selecione um cenário econômico e clique em "Executar Simulação" para visualizar 
                            análises avançadas com Monte Carlo, correlações dinâmicas e métricas de risco.
                          </p>
                          <div className="placeholder-features">
                            <div className="feature-item">📊 Gráficos interativos em tempo real</div>
                            <div className="feature-item">🎲 Simulação Monte Carlo específica</div>
                            <div className="feature-item">📈 Análise de correlações macroeconômicas</div>
                            <div className="feature-item">⚠️ Métricas de risco avançadas (VaR/CVaR)</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                      {cenarios && cenarios.economicos && (
                        <p>
                          <strong>Análise de Cenários:</strong> Dos {cenarios.economicos.length} cenários econômicos testados, 
                          {cenarios.economicos.filter(c => c.resultadoFavoravel).length} apresentam resultados favoráveis à migração. 
                          A probabilidade ponderada de resultado superior, considerando as probabilidades históricas de cada cenário, 
                          é de {formatarPercentual(cenarios.economicos.reduce((acc, c) => acc + (c.resultadoFavoravel ? c.probabilidade : 0), 0))}.
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
