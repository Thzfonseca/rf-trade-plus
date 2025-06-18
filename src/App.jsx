import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import './App.css';

// Função para calcular valor futuro com reinvestimento e IR
const calcularValorFuturo = (valorInicial, indexador, taxa, prazo, premissas, horizonte, tipoReinvestimento, taxaReinvestimento, aliquotaIR = 0) => {
  let valor = valorInicial;
  
  // Primeira fase: até o vencimento do ativo
  for (let ano = 1; ano <= Math.min(prazo, horizonte); ano++) {
    const indicePremissa = Math.min(ano - 1, premissas.cdi.length - 1);
    
    if (indexador === 'pos') {
      valor *= (1 + (premissas.cdi[indicePremissa] / 100) * (taxa / 100));
    } else if (indexador === 'ipca') {
      valor *= (1 + (premissas.ipca[indicePremissa] / 100) + (taxa / 100));
    } else if (indexador === 'pre') {
      valor *= (1 + taxa / 100);
    }
  }
  
  // Aplicar IR no vencimento do ativo principal
  if (prazo <= horizonte && aliquotaIR > 0) {
    const rendimento = valor - valorInicial;
    const impostoDevido = rendimento * (aliquotaIR / 100);
    valor -= impostoDevido;
  }
  
  // Segunda fase: reinvestimento (se necessário)
  if (prazo < horizonte) {
    for (let ano = prazo + 1; ano <= horizonte; ano++) {
      const indicePremissa = Math.min(ano - 1, premissas.cdi.length - 1);
      
      if (tipoReinvestimento === 'cdi') {
        valor *= (1 + (premissas.cdi[indicePremissa] / 100) * (taxaReinvestimento / 100));
      } else if (tipoReinvestimento === 'ipca') {
        valor *= (1 + (premissas.ipca[indicePremissa] / 100) + (taxaReinvestimento / 100));
      } else if (tipoReinvestimento === 'pre') {
        valor *= (1 + taxaReinvestimento / 100);
      }
    }
  }
  
  return valor;
};

// Função para simular Monte Carlo
const simularMonteCarlo = (ativoAtual, ativoProposto, premissas, horizonte, numSimulacoes = 10000) => {
  const resultados = [];
  
  for (let i = 0; i < numSimulacoes; i++) {
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
      ativoAtual.taxaReinvestimento,
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
      100,
      ativoProposto.aliquotaIR
    );
    
    resultados.push({
      atual: valorAtual,
      proposto: valorProposto,
      diferenca: valorProposto - valorAtual
    });
  }
  
  // Calcular estatísticas
  const diferencas = resultados.map(r => r.diferenca).sort((a, b) => a - b);
  const sucessos = diferencas.filter(d => d > 0).length;
  const probabilidadeSuperior = (sucessos / numSimulacoes) * 100;
  
  const media = diferencas.reduce((a, b) => a + b, 0) / numSimulacoes;
  const var95 = diferencas[Math.floor(numSimulacoes * 0.05)];
  const percentil25 = diferencas[Math.floor(numSimulacoes * 0.25)];
  const percentil75 = diferencas[Math.floor(numSimulacoes * 0.75)];
  
  // Calcular Sharpe Ratio simplificado
  const desvio = Math.sqrt(diferencas.reduce((acc, val) => acc + Math.pow(val - media, 2), 0) / numSimulacoes);
  const sharpeRatio = desvio > 0 ? media / desvio : 0;
  
  // Gerar dados para histograma/curva normal
  const min = Math.min(...diferencas);
  const max = Math.max(...diferencas);
  const numBins = 50;
  const binSize = (max - min) / numBins;
  
  const histogramData = [];
  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binSize;
    const binEnd = binStart + binSize;
    const count = diferencas.filter(d => d >= binStart && d < binEnd).length;
    const frequency = count / numSimulacoes;
    
    histogramData.push({
      x: binStart + binSize / 2,
      frequency: frequency,
      count: count,
      // Curva normal teórica
      normal: (1 / (desvio * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((binStart + binSize / 2 - media) / desvio, 2)) * binSize
    });
  }
  
  return {
    resultados,
    probabilidadeSuperior,
    media,
    var95,
    percentil25,
    percentil75,
    sharpeRatio,
    desvio,
    histogramData
  };
};

// Função para gerar dados dos gráficos
const gerarDadosGraficos = (ativoAtual, ativoProposto, premissas, horizonte) => {
  const dadosEvolucao = [];
  const dadosRentabilidade = [];
  
  let valorAtual = ativoAtual.valorInvestido;
  let valorProposto = ativoAtual.valorInvestido;
  
  for (let ano = 0; ano <= horizonte; ano++) {
    if (ano === 0) {
      dadosEvolucao.push({
        ano: `Ano ${ano}`,
        atual: valorAtual,
        proposto: valorProposto
      });
      dadosRentabilidade.push({
        ano: `Ano ${ano}`,
        atual: 0,
        proposto: 0
      });
    } else {
      const indicePremissa = Math.min(ano - 1, premissas.cdi.length - 1);
      
      // Calcular valor atual
      if (ano <= ativoAtual.prazo) {
        if (ativoAtual.indexador === 'pos') {
          valorAtual *= (1 + (premissas.cdi[indicePremissa] / 100) * (ativoAtual.taxa / 100));
        } else if (ativoAtual.indexador === 'ipca') {
          valorAtual *= (1 + (premissas.ipca[indicePremissa] / 100) + (ativoAtual.taxa / 100));
        } else if (ativoAtual.indexador === 'pre') {
          valorAtual *= (1 + ativoAtual.taxa / 100);
        }
      } else {
        // Reinvestimento
        if (ativoAtual.tipoReinvestimento === 'cdi') {
          valorAtual *= (1 + (premissas.cdi[indicePremissa] / 100) * (ativoAtual.taxaReinvestimento / 100));
        } else if (ativoAtual.tipoReinvestimento === 'ipca') {
          valorAtual *= (1 + (premissas.ipca[indicePremissa] / 100) + (ativoAtual.taxaReinvestimento / 100));
        } else if (ativoAtual.tipoReinvestimento === 'pre') {
          valorAtual *= (1 + ativoAtual.taxaReinvestimento / 100);
        }
      }
      
      // Calcular valor proposto
      if (ano <= ativoProposto.prazo) {
        if (ativoProposto.indexador === 'pos') {
          valorProposto *= (1 + (premissas.cdi[indicePremissa] / 100) * (ativoProposto.taxa / 100));
        } else if (ativoProposto.indexador === 'ipca') {
          valorProposto *= (1 + (premissas.ipca[indicePremissa] / 100) + (ativoProposto.taxa / 100));
        } else if (ativoProposto.indexador === 'pre') {
          valorProposto *= (1 + ativoProposto.taxa / 100);
        }
      } else {
        // Reinvestimento em CDI 100%
        valorProposto *= (1 + (premissas.cdi[indicePremissa] / 100));
      }
      
      const rentabilidadeAtual = ((valorAtual / ativoAtual.valorInvestido) - 1) * 100;
      const rentabilidadeProposta = ((valorProposto / ativoAtual.valorInvestido) - 1) * 100;
      
      dadosEvolucao.push({
        ano: `Ano ${ano}`,
        atual: valorAtual,
        proposto: valorProposto
      });
      
      dadosRentabilidade.push({
        ano: `Ano ${ano}`,
        atual: rentabilidadeAtual,
        proposto: rentabilidadeProposta
      });
    }
  }
  
  return { dadosEvolucao, dadosRentabilidade };
};

// Função para formatar valores em milhões - CORRIGIDA
const formatarValorMilhoes = (valor) => {
  if (valor >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1)}M`;
  } else if (valor >= 1000) {
    return `R$ ${(valor / 1000).toFixed(0)}K`;
  } else {
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
};

// Função para formatar valores COMPLETOS (sem arredondamento)
const formatarValorCompleto = (valor) => {
  return valor.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Função para formatar percentual - CORRIGIDA
const formatarPercentual = (valor) => {
  return `${valor.toFixed(1)}%`;
};

// Função para obter nome do indexador
const getIndexadorNome = (indexador, taxa) => {
  switch (indexador) {
    case 'pos': return `${taxa}% do CDI`;
    case 'pre': return `Pré-fixado ${taxa}%`;
    case 'ipca': return `IPCA + ${taxa}%`;
    default: return 'N/A';
  }
};

// Função para obter tipo de reinvestimento
const getTipoReinvestimento = (tipo, taxa) => {
  switch (tipo) {
    case 'cdi': return `${taxa}% do CDI`;
    case 'pre': return `Pré-fixado ${taxa}%`;
    case 'ipca': return `IPCA + ${taxa}%`;
    default: return 'N/A';
  }
};

// Função para analisar tendência das premissas
const analisarTendenciaPremissas = (premissas) => {
  const cdiInicial = premissas.cdi[0];
  const cdiFinal = premissas.cdi[premissas.cdi.length - 1];
  const ipcaInicial = premissas.ipca[0];
  const ipcaFinal = premissas.ipca[premissas.ipca.length - 1];
  
  const deltaCDI = cdiFinal - cdiInicial;
  const deltaIPCA = ipcaFinal - ipcaInicial;
  
  if (deltaCDI < -1 && deltaIPCA < -0.5) {
    return "normalização monetária, com expectativa de redução tanto da taxa básica de juros quanto da inflação";
  } else if (deltaCDI > 1 && deltaIPCA > 0.5) {
    return "aperto monetário, com expectativa de elevação das taxas de juros e pressões inflacionárias";
  } else if (deltaCDI < -1 && Math.abs(deltaIPCA) < 0.5) {
    return "flexibilização monetária, com expectativa de redução da taxa básica de juros e inflação estável";
  } else if (Math.abs(deltaCDI) < 1 && deltaIPCA > 0.5) {
    return "pressão inflacionária, com expectativa de estabilidade nas taxas de juros mas elevação da inflação";
  } else {
    return "estabilidade macroeconômica, com expectativa de manutenção dos patamares atuais de juros e inflação";
  }
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
    taxaReinvestimento: 100,
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
  const [abaAtiva, setAbaAtiva] = useState('resumo');

  // Calcular horizonte automaticamente
  const horizonte = Math.max(ativoAtual.prazo, ativoProposto.prazo);

  const calcularAnalise = () => {
    // Calcular valores finais
    const valorFinalAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissas,
      horizonte,
      ativoAtual.tipoReinvestimento,
      ativoAtual.taxaReinvestimento,
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
      100,
      ativoProposto.aliquotaIR
    );

    const vantagem = valorFinalProposto - valorFinalAtual;
    const vantagemPercentual = (vantagem / valorFinalAtual) * 100;
    const vantagemAnualizada = (Math.pow(valorFinalProposto / valorFinalAtual, 1/horizonte) - 1) * 100;

    // Gerar dados dos gráficos
    const { dadosEvolucao, dadosRentabilidade } = gerarDadosGraficos(ativoAtual, ativoProposto, premissas, horizonte);

    // Simular Monte Carlo
    const resultadosMonteCarlo = simularMonteCarlo(ativoAtual, ativoProposto, premissas, horizonte);

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
  };

  // Função para gerar relatório CORRIGIDO
  const gerarRelatorio = () => {
    if (!resultados || !monteCarlo) return '';

    const tendencia = analisarTendenciaPremissas(premissas);
    const indexadorReinvestimento = getTipoReinvestimento(ativoAtual.tipoReinvestimento, ativoAtual.taxaReinvestimento);
    
    // Determinar qual ativo tem prazo menor para reinvestimento
    const ativoMaisCurto = ativoAtual.prazo < ativoProposto.prazo ? 'atual' : 'proposto';
    const textoReinvestimento = ativoMaisCurto === 'atual' ? 
      `com reinvestimento em ${indexadorReinvestimento}` : 
      'com reinvestimento em 100% do CDI';
    
    let recomendacao = '';
    let justificativa = '';
    
    if (resultados.vantagemAnualizada > 1 && monteCarlo.probabilidadeSuperior > 70) {
      recomendacao = 'MIGRAR';
      justificativa = 'A vantagem anualizada significativa combinada com alta probabilidade de sucesso oferece uma oportunidade atrativa de otimização do portfólio.';
    } else if (resultados.vantagemAnualizada > 0.5 && monteCarlo.probabilidadeSuperior > 60) {
      recomendacao = 'CONSIDERAR';
      justificativa = 'A vantagem moderada com probabilidade razoável de sucesso sugere uma oportunidade que merece análise mais detalhada.';
    } else {
      recomendacao = 'MANTER';
      justificativa = 'A vantagem limitada ou baixa probabilidade de sucesso não justifica a migração no momento atual.';
    }

    return `
**ANÁLISE DE OPORTUNIDADE DE INVESTIMENTO EM RENDA FIXA**

Prezado investidor,

Realizamos uma análise quantitativa abrangente para avaliar a oportunidade de migração do seu investimento atual para uma nova estratégia de renda fixa. Nossa metodologia combina projeções determinísticas baseadas em premissas macroeconômicas estruturadas com simulação estocástica Monte Carlo, oferecendo uma visão completa dos riscos e oportunidades envolvidos.

**CONTEXTO MACROECONÔMICO E PREMISSAS**

Nossa análise fundamenta-se em um cenário de ${tendencia}. As premissas macroeconômicas utilizadas refletem expectativas de mercado para os próximos cinco anos:

| Período | Ano 1 | Ano 2 | Ano 3 | Ano 4 | Ano 5 |
|---------|-------|-------|-------|-------|-------|
| CDI     | ${premissas.cdi[0]}% | ${premissas.cdi[1]}% | ${premissas.cdi[2]}% | ${premissas.cdi[3]}% | ${premissas.cdi[4]}% |
| IPCA    | ${premissas.ipca[0]}% | ${premissas.ipca[1]}% | ${premissas.ipca[2]}% | ${premissas.ipca[3]}% | ${premissas.ipca[4]}% |

**COMPARAÇÃO DE ESTRATÉGIAS**

**Estratégia Atual:** ${getIndexadorNome(ativoAtual.indexador, ativoAtual.taxa)} por ${ativoAtual.prazo} anos${ativoAtual.prazo < horizonte ? `, ${textoReinvestimento}` : ''}.
**Valor Final Projetado:** ${formatarValorCompleto(resultados.valorFinalAtual)}

**Estratégia Proposta:** ${getIndexadorNome(ativoProposto.indexador, ativoProposto.taxa)} por ${ativoProposto.prazo} anos${ativoProposto.prazo < horizonte ? ', com reinvestimento em 100% do CDI' : ''}.
**Valor Final Projetado:** ${formatarValorCompleto(resultados.valorFinalProposto)}

**Vantagem da Estratégia Proposta:** ${formatarValorCompleto(resultados.vantagem)} (${resultados.vantagemPercentual.toFixed(2)}% total, ${resultados.vantagemAnualizada.toFixed(2)}% a.a.)

A análise determinística indica que a estratégia proposta oferece uma vantagem de ${resultados.vantagemAnualizada.toFixed(2)}% ao ano sobre a estratégia atual. Esta vantagem reflete a capacidade da nova estratégia de capturar melhor as oportunidades do cenário macroeconômico projetado.

**VALIDAÇÃO POR SIMULAÇÃO MONTE CARLO**

Para validar nossa análise determinística e quantificar os riscos envolvidos, realizamos uma simulação Monte Carlo com 10.000 cenários alternativos. Esta metodologia, amplamente utilizada em gestão de riscos financeiros, permite incorporar a incerteza inerente às projeções macroeconômicas.

**Metodologia:** Cada simulação varia aleatoriamente as premissas de CDI (±2 p.p.) e IPCA (±1 p.p.) dentro de faixas historicamente plausíveis, gerando uma distribuição de resultados possíveis.

**Resultados da Simulação:**
- **Probabilidade de Superioridade:** ${monteCarlo.probabilidadeSuperior.toFixed(1)}%
- **Vantagem Média:** ${formatarValorCompleto(monteCarlo.media)}
- **VaR 95% (Pior Cenário):** ${formatarValorCompleto(monteCarlo.var95)}
- **Sharpe Ratio:** ${monteCarlo.sharpeRatio.toFixed(2)}

**Interpretação dos Resultados:**

A probabilidade de ${monteCarlo.probabilidadeSuperior.toFixed(1)}% indica que, em ${Math.round(monteCarlo.probabilidadeSuperior/10)*10}% dos cenários simulados, a estratégia proposta supera a atual. O VaR 95% de ${formatarValorCompleto(monteCarlo.var95)} representa a perda máxima esperada em apenas 5% dos cenários mais adversos.

O Sharpe Ratio de ${monteCarlo.sharpeRatio.toFixed(2)} ${monteCarlo.sharpeRatio > 1 ? 'indica uma relação risco-retorno excelente' : monteCarlo.sharpeRatio > 0.5 ? 'sugere uma relação risco-retorno adequada' : 'aponta para uma relação risco-retorno que requer cautela'}, considerando a volatilidade dos resultados em relação ao retorno esperado.

**NOSSA RECOMENDAÇÃO**

**${recomendacao}** para a estratégia proposta.

**Justificativa:** ${justificativa} ${tendencia.includes('normalização') && ativoProposto.indexador === 'pre' ? 'O cenário de queda do CDI favorece estratégias pré-fixadas com taxas atrativas.' : tendencia.includes('pressão inflacionária') && ativoProposto.indexador === 'ipca' ? 'O cenário de pressão inflacionária favorece ativos indexados à inflação.' : ''}

Atenciosamente
`;
  };

  const copiarRelatorio = () => {
    const relatorio = gerarRelatorio();
    navigator.clipboard.writeText(relatorio);
    alert('Relatório copiado para a área de transferência!');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">RF TRADE+</h1>
        </div>
      </header>

      <main className="main-content">
        {/* Seção de Inputs */}
        <div className="inputs-section">
          <div className="inputs-grid">
            {/* Premissas Macroeconômicas */}
            <div className="input-card">
              <h3 className="card-title">Premissas Macroeconômicas</h3>
              <div className="premissas-table">
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Ano 1</th>
                      <th>Ano 2</th>
                      <th>Ano 3</th>
                      <th>Ano 4</th>
                      <th>Ano 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>CDI</strong></td>
                      {premissas.cdi.map((valor, index) => (
                        <td key={index}>
                          <input
                            type="number"
                            step="0.1"
                            value={valor}
                            onChange={(e) => {
                              const novasPremissas = { ...premissas };
                              novasPremissas.cdi[index] = parseFloat(e.target.value) || 0;
                              setPremissas(novasPremissas);
                            }}
                            className="input-tiny"
                          />
                          <span className="input-suffix">%</span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td><strong>IPCA</strong></td>
                      {premissas.ipca.map((valor, index) => (
                        <td key={index}>
                          <input
                            type="number"
                            step="0.1"
                            value={valor}
                            onChange={(e) => {
                              const novasPremissas = { ...premissas };
                              novasPremissas.ipca[index] = parseFloat(e.target.value) || 0;
                              setPremissas(novasPremissas);
                            }}
                            className="input-tiny"
                          />
                          <span className="input-suffix">%</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ativo Atual */}
            <div className="input-card">
              <h3 className="card-title">Ativo Atual</h3>
              <div className="input-group">
                <label>Indexador</label>
                <select
                  value={ativoAtual.indexador}
                  onChange={(e) => setAtivoAtual({...ativoAtual, indexador: e.target.value})}
                  className="input-field"
                >
                  <option value="pos">Pós-fixado (% CDI)</option>
                  <option value="pre">Pré-fixado</option>
                  <option value="ipca">IPCA+</option>
                </select>
              </div>
              <div className="input-group">
                <label>Taxa (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={ativoAtual.taxa}
                  onChange={(e) => setAtivoAtual({...ativoAtual, taxa: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Prazo (anos)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ativoAtual.prazo}
                  onChange={(e) => setAtivoAtual({...ativoAtual, prazo: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Valor Investido (R$)</label>
                <input
                  type="number"
                  value={ativoAtual.valorInvestido}
                  onChange={(e) => setAtivoAtual({...ativoAtual, valorInvestido: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Reinvestimento</label>
                <select
                  value={ativoAtual.tipoReinvestimento}
                  onChange={(e) => setAtivoAtual({...ativoAtual, tipoReinvestimento: e.target.value})}
                  className="input-field"
                >
                  <option value="cdi">% CDI</option>
                  <option value="pre">Pré-fixado</option>
                  <option value="ipca">IPCA+</option>
                </select>
              </div>
              <div className="input-group">
                <label>Taxa Reinvestimento (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={ativoAtual.taxaReinvestimento}
                  onChange={(e) => setAtivoAtual({...ativoAtual, taxaReinvestimento: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Alíquota IR (%)</label>
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

            {/* Ativo Proposto */}
            <div className="input-card">
              <h3 className="card-title">Ativo Proposto</h3>
              <div className="input-group">
                <label>Indexador</label>
                <select
                  value={ativoProposto.indexador}
                  onChange={(e) => setAtivoProposto({...ativoProposto, indexador: e.target.value})}
                  className="input-field"
                >
                  <option value="pos">Pós-fixado (% CDI)</option>
                  <option value="pre">Pré-fixado</option>
                  <option value="ipca">IPCA+</option>
                </select>
              </div>
              <div className="input-group">
                <label>Taxa (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={ativoProposto.taxa}
                  onChange={(e) => setAtivoProposto({...ativoProposto, taxa: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Prazo (anos)</label>
                <input
                  type="number"
                  step="0.5"
                  value={ativoProposto.prazo}
                  onChange={(e) => setAtivoProposto({...ativoProposto, prazo: parseFloat(e.target.value) || 0})}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Alíquota IR (%)</label>
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
              <div className="info-display">
                <label>Horizonte de Análise</label>
                <div className="horizonte-info">
                  <span className="horizonte-value">{horizonte} anos</span>
                  <span className="horizonte-desc">(Prazo do ativo mais longo)</span>
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
                    <div className="metric-card highlight">
                      <h4>Vantagem</h4>
                      <p className="metric-value">{formatarValorCompleto(resultados.vantagem)}</p>
                      <p className="metric-label">{resultados.vantagemAnualizada.toFixed(2)}% a.a.</p>
                    </div>
                    <div className="metric-card">
                      <h4>Probabilidade Monte Carlo</h4>
                      <p className="metric-value">{monteCarlo?.probabilidadeSuperior.toFixed(1)}%</p>
                      <p className="metric-label">Chance de superioridade</p>
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 'graficos' && (
                <div className="graficos-content">
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
                          formatter={(value) => [formatarValorCompleto(value), '']}
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
                        {ativoAtual.prazo < horizonte && (
                          <ReferenceLine 
                            x={`Ano ${ativoAtual.prazo}`} 
                            stroke="#f59e0b" 
                            strokeDasharray="5 5"
                            label={{ value: "Vencimento", position: "top", fontSize: 11 }}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-container">
                    <h4>Rentabilidade Acumulada</h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={resultados.dadosRentabilidade}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="ano" stroke="#64748b" fontSize={12} />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={formatarPercentual}
                          domain={['dataMin * 0.98', 'dataMax * 1.02']}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value) => [formatarPercentual(value), '']}
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
                  <h3>Análise de Simulação Monte Carlo</h3>
                  
                  {/* Gráfico de Distribuição */}
                  <div className="chart-container">
                    <h4>Distribuição de Resultados (10.000 Simulações)</h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monteCarlo.histogramData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="x" 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={formatarValorMilhoes}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                          width={60}
                        />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'frequency' ? `${(value * 100).toFixed(2)}%` : value.toFixed(4),
                            name === 'frequency' ? 'Frequência' : 'Curva Normal'
                          ]}
                          labelFormatter={(value) => `Diferença: ${formatarValorMilhoes(value)}`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="frequency" 
                          fill="#3b82f6" 
                          fillOpacity={0.7}
                          name="Frequência Observada"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="normal" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          name="Curva Normal Teórica"
                          dot={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="monte-carlo-explanation">
                    <div className="explanation-section">
                      <h4>🎯 Por que usar Simulação Monte Carlo?</h4>
                      <p>
                        Imagine que você está planejando uma viagem e quer saber se vai chover. Você pode olhar a previsão do tempo (análise determinística), 
                        mas sabemos que o clima é incerto. A simulação Monte Carlo é como analisar milhares de cenários climáticos possíveis para entender 
                        a probabilidade real de chuva.
                      </p>
                      <p>
                        Em investimentos, nossa análise determinística projeta um cenário específico baseado em premissas fixas. Mas a economia é dinâmica: 
                        o CDI pode variar mais ou menos que o esperado, a inflação pode surpreender. Monte Carlo nos permite testar milhares de cenários 
                        econômicos alternativos, revelando a robustez de nossa estratégia.
                      </p>
                    </div>

                    <div className="explanation-section">
                      <h4>🔬 Metodologia da Simulação</h4>
                      <p>
                        Realizamos <strong>10.000 simulações independentes</strong>, onde em cada uma variamos aleatoriamente as premissas macroeconômicas 
                        dentro de faixas historicamente observadas:
                      </p>
                      <ul>
                        <li><strong>CDI:</strong> ±2 pontos percentuais (reflete volatilidade histórica da Selic)</li>
                        <li><strong>IPCA:</strong> ±1 ponto percentual (captura surpresas inflacionárias típicas)</li>
                      </ul>
                      <p>
                        Essas variações não são arbitrárias - baseiam-se na volatilidade histórica destes indicadores nos últimos 20 anos, 
                        capturando desde cenários de crise (2002, 2015) até períodos de estabilidade excepcional (2017-2019).
                      </p>
                    </div>

                    <div className="explanation-section">
                      <h4>📊 Interpretação dos Resultados</h4>
                      <div className="metrics-explanation">
                        <div className="metric-explanation">
                          <h5>🎯 Probabilidade de Superioridade: {monteCarlo.probabilidadeSuperior.toFixed(1)}%</h5>
                          <p>
                            <strong>O que significa:</strong> Em {Math.round(monteCarlo.probabilidadeSuperior/10)*10}% dos 10.000 cenários testados, 
                            a estratégia proposta superou a atual.
                          </p>
                          <p>
                            <strong>Interpretação prática:</strong> {monteCarlo.probabilidadeSuperior > 75 ? 
                              'Probabilidade muito alta - estratégia robusta mesmo em cenários adversos.' : 
                             monteCarlo.probabilidadeSuperior > 60 ? 
                              'Probabilidade moderada - estratégia interessante, mas requer monitoramento.' : 
                              'Probabilidade baixa - estratégia arriscada, considere alternativas.'}
                          </p>
                        </div>

                        <div className="metric-explanation">
                          <h5>⚠️ VaR 95%: {formatarValorCompleto(monteCarlo.var95)}</h5>
                          <p>
                            <strong>O que significa:</strong> Value at Risk - no pior cenário (5% de probabilidade), 
                            a perda máxima seria de {formatarValorCompleto(Math.abs(monteCarlo.var95))}.
                          </p>
                          <p>
                            <strong>Exemplo prático:</strong> É como dizer "há 95% de chance de que o resultado seja melhor que isso". 
                            Bancos usam VaR para definir limites de risco - um VaR de R$ 50K significa que, em 19 de cada 20 cenários, 
                            a perda será menor que R$ 50K.
                          </p>
                        </div>

                        <div className="metric-explanation">
                          <h5>📈 Sharpe Ratio: {monteCarlo.sharpeRatio.toFixed(2)}</h5>
                          <p>
                            <strong>O que significa:</strong> Mede quanto retorno extra você recebe por unidade de risco assumido.
                          </p>
                          <p>
                            <strong>Interpretação:</strong> {monteCarlo.sharpeRatio > 1 ? 
                              'Excelente (>1.0) - retorno compensa bem o risco assumido.' : 
                             monteCarlo.sharpeRatio > 0.5 ? 
                              'Adequado (0.5-1.0) - relação risco-retorno razoável.' : 
                              'Baixo (<0.5) - muito risco para pouco retorno adicional.'}
                          </p>
                          <p>
                            <strong>Comparação:</strong> Fundos de ações brasileiros têm Sharpe médio de 0.3-0.6. 
                            Estratégias de renda fixa com Sharpe > 0.8 são consideradas muito atrativas.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="explanation-section">
                      <h4>🎯 Implicações para Sua Decisão</h4>
                      <p>
                        A simulação Monte Carlo revela que, mesmo considerando a incerteza macroeconômica inerente ao mercado brasileiro, 
                        {monteCarlo.probabilidadeSuperior > 70 ? 
                          ' existe forte evidência estatística favorável à estratégia proposta. A alta probabilidade de sucesso, combinada com métricas de risco controladas, sugere uma oportunidade robusta que merece consideração séria.' :
                         monteCarlo.probabilidadeSuperior > 60 ?
                          ' existe evidência moderada favorável à estratégia proposta. A probabilidade razoável de sucesso indica uma oportunidade interessante, mas que requer análise cuidadosa dos fatores qualitativos e monitoramento contínuo.' :
                          ' a evidência estatística é limitada para a estratégia proposta. A baixa probabilidade de sucesso sugere que os benefícios podem não compensar os riscos de migração, especialmente considerando custos de transação e tributação.'}
                      </p>
                      <p>
                        <strong>Recomendação de gestão de risco:</strong> Independente da decisão, monitore mensalmente os indicadores macroeconômicos. 
                        Se o CDI ou IPCA desviarem significativamente das premissas (>1 p.p.), reavalie a estratégia.
                      </p>
                    </div>
                  </div>

                  <div className="monte-carlo-stats">
                    <div className="stat-card">
                      <h4>Probabilidade de Sucesso</h4>
                      <p className="stat-value">{monteCarlo.probabilidadeSuperior.toFixed(1)}%</p>
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
                      <h4>Sharpe Ratio</h4>
                      <p className="stat-value">{monteCarlo.sharpeRatio.toFixed(2)}</p>
                    </div>
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

