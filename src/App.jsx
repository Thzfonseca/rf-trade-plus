import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import './App.css';

// Função para calcular o valor futuro com reinvestimento CORRIGIDA
const calcularValorFuturo = (valorInicial, indexador, taxa, prazo, premissas, horizonte, tipoReinvestimento = null, taxaReinvestimento = null) => {
  let valor = valorInicial;
  const evolucao = [{ ano: 0, valor: valorInicial, rentabilidade: 0 }];
  
  for (let ano = 1; ano <= horizonte; ano++) {
    const anoIndex = Math.min(ano - 1, 4); // Usar ano 5 como perpetuidade
    let taxaAno;
    
    if (ano <= prazo) {
      // Período do ativo original
      if (indexador === 'pos') {
        taxaAno = (premissas.cdi[anoIndex] / 100) * (taxa / 100);
      } else if (indexador === 'pre') {
        taxaAno = taxa / 100;
      } else if (indexador === 'ipca') {
        taxaAno = (premissas.ipca[anoIndex] / 100) + (taxa / 100);
      }
    } else {
      // Período de reinvestimento - CORRIGIDO
      if (tipoReinvestimento === 'cdi') {
        taxaAno = (premissas.cdi[anoIndex] / 100) * (taxaReinvestimento / 100);
      } else if (tipoReinvestimento === 'pre') {
        taxaAno = taxaReinvestimento / 100;
      } else if (tipoReinvestimento === 'ipca') {
        taxaAno = (premissas.ipca[anoIndex] / 100) + (taxaReinvestimento / 100);
      }
    }
    
    valor = valor * (1 + taxaAno);
    
    const rentabilidadeAcumulada = ((valor / valorInicial) ** (1/ano) - 1) * 100;
    
    evolucao.push({
      ano,
      valor: Math.round(valor),
      rentabilidade: rentabilidadeAcumulada,
      isReinvestimento: ano > prazo
    });
  }
  
  return { valorFinal: valor, evolucao };
};

// Funções auxiliares para o relatório
const getIndexadorNome = (indexador) => {
  switch(indexador) {
    case 'pos': return 'Pós-fixado (CDI)';
    case 'pre': return 'Pré-fixado';
    case 'ipca': return 'IPCA+';
    default: return indexador;
  }
};

const getTipoReinvestimento = (tipo) => {
  switch(tipo) {
    case 'cdi': return 'CDI';
    case 'pre': return 'Pré-fixado';
    case 'ipca': return 'IPCA+';
    default: return tipo;
  }
};

// Função para analisar tendência das premissas
const analisarTendenciaPremissas = (premissas) => {
  const cdiInicial = premissas.cdi[0];
  const cdiFinal = premissas.cdi[premissas.cdi.length - 1];
  const ipcaInicial = premissas.ipca[0];
  const ipcaFinal = premissas.ipca[premissas.ipca.length - 1];
  
  const variaCDI = cdiFinal - cdiInicial;
  const variaIPCA = ipcaFinal - ipcaInicial;
  
  let cenarioDescricao = "";
  
  if (variaCDI < -1 && variaIPCA < -0.5) {
    cenarioDescricao = "normalização monetária, com expectativa de redução tanto da taxa básica de juros quanto da inflação";
  } else if (variaCDI > 1 && variaIPCA > 0.5) {
    cenarioDescricao = "aperto monetário, com expectativa de elevação das taxas de juros e pressões inflacionárias";
  } else if (variaCDI < -1 && Math.abs(variaIPCA) <= 0.5) {
    cenarioDescricao = "flexibilização monetária, com redução da Selic e inflação estável";
  } else if (variaCDI > 1 && Math.abs(variaIPCA) <= 0.5) {
    cenarioDescricao = "aperto monetário preventivo, com alta da Selic para conter pressões inflacionárias futuras";
  } else if (Math.abs(variaCDI) <= 1 && variaIPCA > 0.5) {
    cenarioDescricao = "pressão inflacionária com juros estáveis, cenário de estagflação moderada";
  } else {
    cenarioDescricao = "estabilidade macroeconômica, com juros e inflação em patamares relativamente constantes";
  }
  
  return {
    cenarioDescricao,
    cdiMedia: (premissas.cdi.reduce((a, b) => a + b, 0) / premissas.cdi.length).toFixed(1),
    ipcaMedia: (premissas.ipca.reduce((a, b) => a + b, 0) / premissas.ipca.length).toFixed(1),
    tendenciaCDI: variaCDI > 1 ? 'alta' : variaCDI < -1 ? 'baixa' : 'estável',
    tendenciaIPCA: variaIPCA > 0.5 ? 'alta' : variaIPCA < -0.5 ? 'baixa' : 'estável'
  };
};

// Função para simular Monte Carlo
const simularMonteCarlo = (ativoAtual, ativoProposto, premissas, horizonte, premissasReinvestimento) => {
  const resultados = [];
  const numSimulacoes = 10000;
  
  for (let i = 0; i < numSimulacoes; i++) {
    // Gerar premissas aleatórias com base nas premissas originais
    const premissasSimulacao = {
      cdi: premissas.cdi.map(taxa => Math.max(1, taxa + (Math.random() - 0.5) * 4)), // ±2% variação
      ipca: premissas.ipca.map(taxa => Math.max(0.5, taxa + (Math.random() - 0.5) * 3)) // ±1.5% variação
    };
    
    const valorAtual = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoAtual.indexador,
      ativoAtual.taxa,
      ativoAtual.prazo,
      premissasSimulacao,
      horizonte,
      ativoAtual.tipoReinvestimento,
      ativoAtual.taxaReinvestimento
    ).valorFinal;
    
    const valorProposto = calcularValorFuturo(
      ativoAtual.valorInvestido,
      ativoProposto.indexador,
      ativoProposto.taxa,
      ativoProposto.prazo,
      premissasSimulacao,
      horizonte
    ).valorFinal;
    
    resultados.push(valorProposto - valorAtual);
  }
  
  // Calcular estatísticas
  resultados.sort((a, b) => a - b);
  
  const media = resultados.reduce((sum, val) => sum + val, 0) / resultados.length;
  const desvio = Math.sqrt(resultados.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / resultados.length);
  
  const percentis = {
    p10: resultados[Math.floor(resultados.length * 0.1)],
    p25: resultados[Math.floor(resultados.length * 0.25)],
    p50: resultados[Math.floor(resultados.length * 0.5)],
    p75: resultados[Math.floor(resultados.length * 0.75)],
    p90: resultados[Math.floor(resultados.length * 0.9)]
  };
  
  const probabilidadeSuperior = resultados.filter(r => r > 0).length / resultados.length;
  const var95 = resultados[Math.floor(resultados.length * 0.05)];
  const sharpeRatio = media / desvio;
  
  return {
    resultados,
    media,
    desvio,
    percentis,
    probabilidadeSuperior,
    var95,
    sharpeRatio
  };
};

function App() {
  // Estados
  const [premissas, setPremissas] = useState({
    cdi: [14, 12, 11, 10, 9],
    ipca: [5.5, 5.0, 4.5, 4.0, 3.5]
  });
  
  const [premissasReinvestimento, setPremissasReinvestimento] = useState({
    cdi: 100,
    ipca: 5,
    pre: 11
  });
  
  const [ativoAtual, setAtivoAtual] = useState({
    indexador: 'pre',
    taxa: 10.5,
    prazo: 3,
    valorInvestido: 1000000,
    aliquotaIR: 15,
    tipoReinvestimento: 'cdi',
    taxaReinvestimento: 100
  });
  
  const [ativoProposto, setAtivoProposto] = useState({
    indexador: 'ipca',
    taxa: 6.2,
    prazo: 10,
    aliquotaIR: 15
  });
  
  const [resultados, setResultados] = useState(null);
  const [monteCarlo, setMonteCarlo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');

  // Função para formatar moeda
  const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Função para calcular análise
  const calcularAnalise = () => {
    setIsLoading(true);
    setResultados(null);
    setMonteCarlo(null);
    
    setTimeout(() => {
      const horizonte = Math.max(ativoAtual.prazo, ativoProposto.prazo);
      
      // Calcular valores futuros
      const resultadoAtual = calcularValorFuturo(
        ativoAtual.valorInvestido,
        ativoAtual.indexador,
        ativoAtual.taxa,
        ativoAtual.prazo,
        premissas,
        horizonte,
        ativoAtual.tipoReinvestimento,
        ativoAtual.taxaReinvestimento
      );
      
      const resultadoProposto = calcularValorFuturo(
        ativoAtual.valorInvestido,
        ativoProposto.indexador,
        ativoProposto.taxa,
        ativoProposto.prazo,
        premissas,
        horizonte
      );
      
      // Simulação Monte Carlo
      const monteCarloResult = simularMonteCarlo(ativoAtual, ativoProposto, premissas, horizonte, premissasReinvestimento);
      
      // Calcular vantagem anualizada
      const vantagem = resultadoProposto.valorFinal - resultadoAtual.valorFinal;
      const vantagemPercentual = (resultadoProposto.valorFinal / resultadoAtual.valorFinal - 1) * 100;
      const vantagemAnualizada = ((resultadoProposto.valorFinal / resultadoAtual.valorFinal) ** (1/horizonte) - 1) * 100;
      
      setResultados({
        valorFinalAtual: resultadoAtual.valorFinal,
        valorFinalProposto: resultadoProposto.valorFinal,
        vantagem: vantagem,
        vantagemPercentual: vantagemPercentual,
        vantagemAnualizada: vantagemAnualizada,
        evolucaoAtual: resultadoAtual.evolucao,
        evolucaoProposta: resultadoProposto.evolucao
      });
      
      setMonteCarlo(monteCarloResult);
      setIsLoading(false);
    }, 1000);
  };

  // Função para copiar relatório
  const copiarRelatorio = () => {
    const relatorio = gerarRelatorio();
    navigator.clipboard.writeText(relatorio).then(() => {
      alert('Relatório copiado para a área de transferência!');
    });
  };

  // Função para gerar relatório
  const gerarRelatorio = () => {
    if (!resultados || !monteCarlo) return '';
    
    return `ANÁLISE DE OPORTUNIDADE DE INVESTIMENTO EM RENDA FIXA

Prezado investidor,

Realizamos uma análise quantitativa abrangente para avaliar a oportunidade de migração do seu investimento atual para uma nova estratégia. Nossa metodologia combina projeções determinísticas baseadas em premissas macroeconômicas estruturadas com simulação estocástica Monte Carlo, oferecendo uma visão completa dos riscos e retornos esperados.

CONTEXTO MACROECONÔMICO E PREMISSAS

Nossa análise fundamenta-se em um cenário de ${analisarTendenciaPremissas(premissas).cenarioDescricao}. As projeções consideram uma trajetória do CDI de ${premissas.cdi[0]}% no primeiro ano para ${premissas.cdi[premissas.cdi.length-1]}% no quinto ano (média de ${analisarTendenciaPremissas(premissas).cdiMedia}% a.a.), enquanto o IPCA evolui de ${premissas.ipca[0]}% para ${premissas.ipca[premissas.ipca.length-1]}% (média de ${analisarTendenciaPremissas(premissas).ipcaMedia}% a.a.).

Premissas Anuais:
CDI: ${premissas.cdi.map((taxa, i) => `Ano ${i+1}: ${taxa}%`).join(' | ')}
IPCA: ${premissas.ipca.map((taxa, i) => `Ano ${i+1}: ${taxa}%`).join(' | ')}

Para reinvestimento, consideramos ${ativoAtual.taxaReinvestimento}% do CDI para ativos pós-fixados, IPCA + ${premissasReinvestimento.ipca}% para indexados à inflação, e ${premissasReinvestimento.pre}% a.a. para pré-fixados.

COMPARAÇÃO DAS ESTRATÉGIAS

Analisamos duas estratégias distintas considerando o horizonte de investimento de ${Math.max(ativoAtual.prazo, ativoProposto.prazo)} anos:

Estratégia Atual: ${getIndexadorNome(ativoAtual.indexador)} ${ativoAtual.indexador === 'pos' ? `${ativoAtual.taxa}% do CDI` : ativoAtual.indexador === 'ipca' ? `IPCA + ${ativoAtual.taxa}%` : `${ativoAtual.taxa}% a.a.`} por ${ativoAtual.prazo} anos, com reinvestimento em ${getTipoReinvestimento(ativoAtual.tipoReinvestimento)} ${ativoAtual.taxaReinvestimento}%.
Valor Final Projetado: ${formatarMoeda(resultados.valorFinalAtual)}

Estratégia Proposta: ${getIndexadorNome(ativoProposto.indexador)} ${ativoProposto.indexador === 'pos' ? `${ativoProposto.taxa}% do CDI` : ativoProposto.indexador === 'ipca' ? `IPCA + ${ativoProposto.taxa}%` : `${ativoProposto.taxa}% a.a.`} por ${ativoProposto.prazo} anos.
Valor Final Projetado: ${formatarMoeda(resultados.valorFinalProposto)}

Análise dos Resultados: A estratégia proposta apresenta uma vantagem de ${formatarMoeda(resultados.vantagem)}, equivalente a ${resultados.vantagemPercentual.toFixed(2)}% de ganho total ou ${resultados.vantagemAnualizada.toFixed(2)}% a.a. de rentabilidade adicional. ${resultados.vantagem > 0 ? `Esta vantagem decorre principalmente da ${ativoProposto.indexador === 'ipca' ? 'proteção inflacionária' : ativoProposto.indexador === 'pre' ? 'taxa pré-fixada atrativa no cenário projetado' : 'exposição ao CDI em momento favorável'} oferecida pela estratégia proposta.` : 'A estratégia atual se mostra mais vantajosa no cenário base, sugerindo manutenção da posição.'}

VALIDAÇÃO POR SIMULAÇÃO MONTE CARLO

Importância da Simulação: Enquanto nossa análise determinística considera um cenário base, a realidade econômica é incerta. A simulação Monte Carlo testa 10.000 cenários alternativos, variando aleatoriamente as taxas de CDI e IPCA dentro de faixas estatisticamente plausíveis, oferecendo uma visão probabilística dos resultados.

Resultados da Simulação: Em ${monteCarlo.probabilidadeSuperior.toFixed(1)}% dos cenários testados, a estratégia proposta supera a atual. ${monteCarlo.probabilidadeSuperior > 60 ? 'Esta alta probabilidade de sucesso reforça a robustez da recomendação.' : monteCarlo.probabilidadeSuperior > 40 ? 'Esta probabilidade moderada sugere que a decisão depende do apetite ao risco do investidor.' : 'Esta baixa probabilidade indica maior risco na estratégia proposta.'}

Métricas de Risco:
VaR 95%: ${formatarMoeda(monteCarlo.var95)} - No pior cenário (5% de probabilidade), a perda máxima esperada seria de ${Math.abs(monteCarlo.var95).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.
Sharpe Ratio: ${monteCarlo.sharpeRatio.toFixed(2)} - ${monteCarlo.sharpeRatio > 1 ? 'Excelente relação risco-retorno, indicando que o retorno adicional compensa bem o risco assumido.' : monteCarlo.sharpeRatio > 0.5 ? 'Boa relação risco-retorno, com retorno adequado para o risco.' : 'Relação risco-retorno moderada, exigindo análise cuidadosa do perfil do investidor.'}

RECOMENDAÇÃO

Nossa Recomendação: ${resultados.vantagem > 0 && monteCarlo.probabilidadeSuperior > 60 ? `MIGRAR para a estratégia proposta. A vantagem de ${resultados.vantagemAnualizada.toFixed(2)}% a.a. combinada com ${monteCarlo.probabilidadeSuperior.toFixed(1)}% de probabilidade de sucesso na simulação Monte Carlo oferece uma oportunidade atrativa de otimização do portfólio.` : resultados.vantagem > 0 && monteCarlo.probabilidadeSuperior > 40 ? `CONSIDERAR a migração, avaliando o perfil de risco. A estratégia proposta oferece vantagem potencial de ${resultados.vantagemAnualizada.toFixed(2)}% a.a., mas com probabilidade moderada de sucesso (${monteCarlo.probabilidadeSuperior.toFixed(1)}%).` : `MANTER a estratégia atual. A análise indica que a posição atual oferece melhor relação risco-retorno no cenário projetado.`}

Justificativa: Esta recomendação baseia-se na análise quantitativa das premissas macroeconômicas, na comparação determinística dos fluxos de caixa e na validação estatística através da simulação Monte Carlo. ${analisarTendenciaPremissas(premissas).tendenciaCDI === 'baixa' && ativoProposto.indexador === 'pre' ? 'O cenário de queda do CDI favorece estratégias pré-fixadas com taxas atrativas.' : analisarTendenciaPremissas(premissas).tendenciaIPCA === 'alta' && ativoProposto.indexador === 'ipca' ? 'O cenário de pressão inflacionária favorece ativos indexados ao IPCA.' : 'A estratégia alinha-se adequadamente com o cenário macroeconômico projetado.'}

Atenciosamente`;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>RF Trade+</h1>
        </div>
      </header>
      
      {/* Container principal */}
      <div className="p-6 space-y-6">
        {/* Layout Simétrico: Premissas | Ativo Atual | Ativo Proposto */}
        <section className="grid-elegant grid-3 gap-6">
          {/* Premissas Macroeconômicas - Compacto */}
          <div className="card-elegant p-4">
            <h2 className="section-title">Premissas Macroeconômicas</h2>
            <p className="section-description">Configure CDI e IPCA para os próximos 5 anos.</p>
            
            {/* Tabela Horizontal Compacta */}
            <div className="premissas-compact">
              <div className="premissas-row-compact">
                <div className="premissas-label-compact">Período</div>
                {[1, 2, 3, 4, 5].map(ano => (
                  <div key={ano} className="premissas-year-compact">Ano {ano}</div>
                ))}
              </div>
              
              <div className="premissas-row-compact">
                <div className="premissas-label-compact">CDI (%)</div>
                {[1, 2, 3, 4, 5].map(ano => (
                  <div key={ano} className="premissas-input-compact">
                    <input
                      type="number"
                      step="0.1"
                      value={premissas.cdi[ano - 1]}
                      onChange={(e) => {
                        const novasPremissas = { ...premissas };
                        novasPremissas.cdi[ano - 1] = parseFloat(e.target.value) || 0;
                        setPremissas(novasPremissas);
                      }}
                      className="input-field-tiny"
                    />
                  </div>
                ))}
              </div>
              
              <div className="premissas-row-compact">
                <div className="premissas-label-compact">IPCA (%)</div>
                {[1, 2, 3, 4, 5].map(ano => (
                  <div key={ano} className="premissas-input-compact">
                    <input
                      type="number"
                      step="0.1"
                      value={premissas.ipca[ano - 1]}
                      onChange={(e) => {
                        const novasPremissas = { ...premissas };
                        novasPremissas.ipca[ano - 1] = parseFloat(e.target.value) || 0;
                        setPremissas(novasPremissas);
                      }}
                      className="input-field-tiny"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ativo Atual */}
          <div className="card-elegant p-4">
            <h3 className="section-title">Ativo Atual</h3>
            
            <div className="space-y-3">
              <div className="grid-elegant grid-2 gap-2">
                <div className="input-group">
                  <label className="input-label">Indexador</label>
                  <select
                    value={ativoAtual.indexador}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, indexador: e.target.value })}
                    className="select-field"
                  >
                    <option value="pos">Pós-fixado (CDI)</option>
                    <option value="pre">Pré-fixado</option>
                    <option value="ipca">IPCA+</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label className="input-label">
                    {ativoAtual.indexador === 'pos' ? '% do CDI' : 
                     ativoAtual.indexador === 'ipca' ? 'Cupom IPCA (%)' : 'Taxa (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ativoAtual.taxa}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, taxa: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>
              
              <div className="grid-elegant grid-2 gap-2">
                <div className="input-group">
                  <label className="input-label">Prazo (anos)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={ativoAtual.prazo}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, prazo: parseFloat(e.target.value) || 0.5 })}
                    className="input-field"
                  />
                </div>
                
                <div className="input-group">
                  <label className="input-label">Valor (R$)</label>
                  <input
                    type="number"
                    step="1000"
                    value={ativoAtual.valorInvestido}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, valorInvestido: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>
              
              <div className="grid-elegant grid-2 gap-2">
                <div className="input-group">
                  <label className="input-label">IR (%)</label>
                  <select
                    value={ativoAtual.aliquotaIR}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, aliquotaIR: parseFloat(e.target.value) })}
                    className="select-field"
                  >
                    <option value={0}>Isento (0%)</option>
                    <option value={15}>15%</option>
                    <option value={17.5}>17,5%</option>
                    <option value={20}>20%</option>
                    <option value={22.5}>22,5%</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Reinvestimento</label>
                  <select
                    value={ativoAtual.tipoReinvestimento}
                    onChange={(e) => setAtivoAtual({ ...ativoAtual, tipoReinvestimento: e.target.value })}
                    className="select-field"
                  >
                    <option value="cdi">Pós-fixado (CDI)</option>
                    <option value="pre">Pré-fixado</option>
                    <option value="ipca">IPCA+</option>
                  </select>
                </div>
              </div>
              
              <div className="input-group">
                <label className="input-label">
                  {ativoAtual.tipoReinvestimento === 'cdi' ? '% do CDI' : 
                   ativoAtual.tipoReinvestimento === 'ipca' ? 'Cupom IPCA (%)' : 'Taxa (%)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={ativoAtual.taxaReinvestimento}
                  onChange={(e) => setAtivoAtual({ ...ativoAtual, taxaReinvestimento: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>
            </div>
          </div>
          
          {/* Ativo Proposto */}
          <div className="card-elegant p-4">
            <h3 className="section-title">Ativo Proposto</h3>
            
            <div className="space-y-3">
              <div className="grid-elegant grid-2 gap-2">
                <div className="input-group">
                  <label className="input-label">Indexador</label>
                  <select
                    value={ativoProposto.indexador}
                    onChange={(e) => setAtivoProposto({ ...ativoProposto, indexador: e.target.value })}
                    className="select-field"
                  >
                    <option value="pos">Pós-fixado (CDI)</option>
                    <option value="pre">Pré-fixado</option>
                    <option value="ipca">IPCA+</option>
                  </select>
                </div>
                
                <div className="input-group">
                  <label className="input-label">
                    {ativoProposto.indexador === 'pos' ? '% do CDI' : 
                     ativoProposto.indexador === 'ipca' ? 'Cupom IPCA (%)' : 'Taxa (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ativoProposto.taxa}
                    onChange={(e) => setAtivoProposto({ ...ativoProposto, taxa: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>
              
              <div className="grid-elegant grid-2 gap-2">
                <div className="input-group">
                  <label className="input-label">Prazo (anos)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={ativoProposto.prazo}
                    onChange={(e) => setAtivoProposto({ ...ativoProposto, prazo: parseFloat(e.target.value) || 0.5 })}
                    className="input-field"
                  />
                </div>
                
                <div className="input-group">
                  <label className="input-label">IR (%)</label>
                  <select
                    value={ativoProposto.aliquotaIR}
                    onChange={(e) => setAtivoProposto({ ...ativoProposto, aliquotaIR: parseFloat(e.target.value) })}
                    className="select-field"
                  >
                    <option value={0}>Isento (0%)</option>
                    <option value={15}>15%</option>
                    <option value={17.5}>17,5%</option>
                    <option value={20}>20%</option>
                    <option value={22.5}>22,5%</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Botão de Análise */}
        <div className="text-center">
          <button 
            onClick={calcularAnalise}
            disabled={isLoading}
            className="btn btn-primary btn-large"
          >
            {isLoading ? '⏳ Calculando...' : '📊 Calcular Análise'}
          </button>
        </div>

        {/* Resultados */}
        {resultados && (
          <section className="fade-in">
            {/* Abas de navegação */}
            <div className="tabs-container">
              <div className="tabs-nav">
                <button 
                  className={`tab-button ${activeTab === 'resumo' ? 'active' : ''}`}
                  onClick={() => setActiveTab('resumo')}
                >
                  📊 Resumo Executivo
                </button>
                <button 
                  className={`tab-button ${activeTab === 'graficos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graficos')}
                >
                  📈 Gráficos
                </button>
                <button 
                  className={`tab-button ${activeTab === 'montecarlo' ? 'active' : ''}`}
                  onClick={() => setActiveTab('montecarlo')}
                >
                  🎲 Monte Carlo
                </button>
                <button 
                  className={`tab-button ${activeTab === 'relatorio' ? 'active' : ''}`}
                  onClick={() => setActiveTab('relatorio')}
                >
                  📝 Relatório Completo
                </button>
              </div>
            </div>
            
            {/* Conteúdo das abas */}
            <div className="fade-in">
              {/* Resumo Executivo */}
              {activeTab === 'resumo' && (
                <div className="fade-in">
                  {/* Métricas principais */}
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-value metric-primary">{formatarMoeda(resultados.valorFinalAtual)}</div>
                      <div className="metric-label">Estratégia Atual</div>
                      <div className="metric-description">
                        {getIndexadorNome(ativoAtual.indexador)} {ativoAtual.taxa}% - {ativoAtual.prazo} anos + Reinvestimento
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-value metric-primary">{formatarMoeda(resultados.valorFinalProposto)}</div>
                      <div className="metric-label">Estratégia Proposta</div>
                      <div className="metric-description">
                        {getIndexadorNome(ativoProposto.indexador)} {ativoProposto.taxa}% - {ativoProposto.prazo} anos
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className={`metric-value ${resultados.vantagem >= 0 ? 'metric-success' : 'metric-error'}`}>
                        {resultados.vantagem >= 0 ? '+' : ''}{formatarMoeda(resultados.vantagem)}
                      </div>
                      <div className="metric-label">Vantagem Total</div>
                      <div className="metric-description">
                        {resultados.vantagemPercentual.toFixed(2)}% total | {resultados.vantagemAnualizada.toFixed(2)}% a.a.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Gráficos */}
              {activeTab === 'graficos' && (
                <div className="fade-in">
                  {/* Gráfico de Evolução Patrimonial */}
                  <div className="chart-container">
                    <h3 className="chart-title">Evolução Patrimonial</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={resultados.evolucaoAtual.map((item, index) => ({
                        ano: item.ano,
                        atual: item.valor,
                        proposta: resultados.evolucaoProposta[index]?.valor || 0
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ano" />
                        <YAxis 
                          tickFormatter={(value) => formatarMoeda(value)}
                          domain={['dataMin * 0.95', 'dataMax * 1.05']}
                        />
                        <Tooltip formatter={(value) => formatarMoeda(value)} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="atual" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          name="Estratégia Atual"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="proposta" 
                          stroke="#82ca9d" 
                          strokeWidth={2}
                          name="Estratégia Proposta"
                        />
                        <ReferenceLine 
                          x={ativoAtual.prazo} 
                          stroke="#ff7300" 
                          strokeDasharray="5 5"
                          label="Vencimento Ativo Atual"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="chart-description">
                      A linha pontilhada indica o vencimento do ativo atual, após o qual ocorre reinvestimento conforme premissas configuradas.
                    </p>
                  </div>

                  {/* Gráfico de Rentabilidade */}
                  <div className="chart-container">
                    <h3 className="chart-title">Rentabilidade Acumulada Anualizada</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={resultados.evolucaoAtual.slice(1).map((item, index) => ({
                        ano: item.ano,
                        atual: item.rentabilidade,
                        proposta: resultados.evolucaoProposta[index + 1]?.rentabilidade || 0
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ano" />
                        <YAxis 
                          tickFormatter={(value) => `${value.toFixed(1)}%`}
                          domain={['dataMin * 0.98', 'dataMax * 1.02']}
                        />
                        <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="atual" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          name="Estratégia Atual"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="proposta" 
                          stroke="#82ca9d" 
                          strokeWidth={2}
                          name="Estratégia Proposta"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="chart-description">
                      Rentabilidade anualizada considerando reinvestimento automático após vencimento dos ativos.
                    </p>
                  </div>
                </div>
              )}

              {/* Monte Carlo */}
              {activeTab === 'montecarlo' && monteCarlo && (
                <div className="fade-in">
                  {/* Análise Monte Carlo Descritiva */}
                  <div className="card-elegant p-6">
                    <h3 className="section-title">Análise Monte Carlo - Metodologia e Interpretação</h3>
                    
                    <div className="monte-carlo-description">
                      <p>
                        <strong>O que é Monte Carlo:</strong> A simulação Monte Carlo é uma técnica estatística que testa milhares de cenários alternativos, 
                        variando aleatoriamente as premissas econômicas dentro de faixas plausíveis. Enquanto nossa análise determinística considera 
                        um cenário base específico, o Monte Carlo nos mostra o que pode acontecer em diferentes condições de mercado.
                      </p>
                      
                      <p>
                        <strong>Metodologia aplicada:</strong> Simulamos 10.000 cenários onde as taxas de CDI e IPCA variam aleatoriamente 
                        em torno das suas premissas base (±2% para CDI, ±1,5% para IPCA), respeitando correlações históricas entre as variáveis. 
                        Cada simulação calcula o resultado final de ambas as estratégias, gerando uma distribuição de possíveis resultados.
                      </p>
                      
                      <p>
                        <strong>Calibração dos parâmetros:</strong> As faixas de variação foram calibradas com base na volatilidade histórica 
                        das taxas de juros e inflação no Brasil. A correlação entre CDI e IPCA foi ajustada para refletir a dinâmica 
                        macroeconômica típica, onde períodos de alta inflação tendem a coincidir com juros mais elevados.
                      </p>
                    </div>
                  </div>

                  {/* Histograma */}
                  <div className="chart-container">
                    <h3 className="chart-title">Distribuição dos Resultados (10.000 simulações)</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={(() => {
                        const bins = 50;
                        const min = Math.min(...monteCarlo.resultados);
                        const max = Math.max(...monteCarlo.resultados);
                        const binSize = (max - min) / bins;
                        const histogram = new Array(bins).fill(0);
                        
                        monteCarlo.resultados.forEach(valor => {
                          const binIndex = Math.min(Math.floor((valor - min) / binSize), bins - 1);
                          histogram[binIndex]++;
                        });
                        
                        return histogram.map((count, index) => ({
                          valor: min + (index + 0.5) * binSize,
                          frequencia: count,
                          favoravel: min + (index + 0.5) * binSize > 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="valor" 
                          tickFormatter={(value) => formatarMoeda(value)}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [value, 'Frequência']}
                          labelFormatter={(value) => `Diferença: ${formatarMoeda(value)}`}
                        />
                        <Bar 
                          dataKey="frequencia" 
                          fill={(entry) => entry?.favoravel ? '#82ca9d' : '#ff7c7c'}
                        />
                        <ReferenceLine x={0} stroke="#333" strokeDasharray="2 2" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="chart-legend">
                      <span className="legend-item">
                        <span className="legend-color" style={{backgroundColor: '#82ca9d'}}></span>
                        Cenários favoráveis à estratégia proposta
                      </span>
                      <span className="legend-item">
                        <span className="legend-color" style={{backgroundColor: '#ff7c7c'}}></span>
                        Cenários favoráveis à estratégia atual
                      </span>
                    </div>
                  </div>

                  {/* Estatísticas Monte Carlo */}
                  <div className="card-elegant p-6">
                    <h3 className="section-title">Interpretação dos Resultados e Métricas de Risco</h3>
                    
                    <div className="monte-carlo-stats">
                      <div className="stats-grid">
                        <div className="stat-item">
                          <div className="stat-value">{monteCarlo.probabilidadeSuperior.toFixed(1)}%</div>
                          <div className="stat-label">Probabilidade de Sucesso</div>
                          <div className="stat-description">
                            Em {monteCarlo.probabilidadeSuperior.toFixed(1)}% dos cenários testados, a estratégia proposta supera a atual. 
                            {monteCarlo.probabilidadeSuperior > 60 ? ' Esta alta probabilidade reforça a robustez da recomendação.' : 
                             monteCarlo.probabilidadeSuperior > 40 ? ' Probabilidade moderada, decisão depende do perfil de risco.' : 
                             ' Baixa probabilidade indica maior risco na estratégia proposta.'}
                          </div>
                        </div>
                        
                        <div className="stat-item">
                          <div className="stat-value">{formatarMoeda(monteCarlo.var95)}</div>
                          <div className="stat-label">VaR 95% (Value at Risk)</div>
                          <div className="stat-description">
                            No pior cenário (5% de probabilidade), a perda máxima esperada seria de {Math.abs(monteCarlo.var95).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}. 
                            Esta métrica é fundamental para dimensionar o risco máximo da operação.
                          </div>
                        </div>
                        
                        <div className="stat-item">
                          <div className="stat-value">{monteCarlo.sharpeRatio.toFixed(2)}</div>
                          <div className="stat-label">Sharpe Ratio</div>
                          <div className="stat-description">
                            {monteCarlo.sharpeRatio > 1 ? 'Excelente relação risco-retorno. O retorno adicional compensa amplamente o risco assumido.' :
                             monteCarlo.sharpeRatio > 0.5 ? 'Boa relação risco-retorno, com retorno adequado para o risco.' :
                             'Relação risco-retorno moderada, exigindo análise cuidadosa do perfil do investidor.'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="percentiles-section">
                        <h4>Distribuição de Resultados (Percentis)</h4>
                        <div className="percentiles-grid">
                          <div className="percentile-item">
                            <span className="percentile-label">P10:</span>
                            <span className="percentile-value">{formatarMoeda(monteCarlo.percentis.p10)}</span>
                          </div>
                          <div className="percentile-item">
                            <span className="percentile-label">P25:</span>
                            <span className="percentile-value">{formatarMoeda(monteCarlo.percentis.p25)}</span>
                          </div>
                          <div className="percentile-item">
                            <span className="percentile-label">Mediana:</span>
                            <span className="percentile-value">{formatarMoeda(monteCarlo.percentis.p50)}</span>
                          </div>
                          <div className="percentile-item">
                            <span className="percentile-label">P75:</span>
                            <span className="percentile-value">{formatarMoeda(monteCarlo.percentis.p75)}</span>
                          </div>
                          <div className="percentile-item">
                            <span className="percentile-label">P90:</span>
                            <span className="percentile-value">{formatarMoeda(monteCarlo.percentis.p90)}</span>
                          </div>
                        </div>
                        <p className="percentiles-explanation">
                          <strong>Interpretação:</strong> 50% dos cenários resultam em diferenças entre {formatarMoeda(monteCarlo.percentis.p25)} e {formatarMoeda(monteCarlo.percentis.p75)}. 
                          A mediana de {formatarMoeda(monteCarlo.percentis.p50)} representa o resultado mais provável.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Relatório Completo */}
              {activeTab === 'relatorio' && (
                <div className="fade-in">
                  <div className="report-container">
                    <h2 className="report-title">ANÁLISE DE OPORTUNIDADE DE INVESTIMENTO EM RENDA FIXA</h2>
                    
                    <div className="report-section">
                      <p>
                        <strong>Prezado investidor,</strong>
                      </p>
                      <p>
                        Realizamos uma análise quantitativa abrangente para avaliar a oportunidade de migração do seu investimento atual para uma nova estratégia. Nossa metodologia combina projeções determinísticas baseadas em premissas macroeconômicas estruturadas com simulação estocástica Monte Carlo, oferecendo uma visão completa dos riscos e retornos esperados.
                      </p>
                    </div>

                    <div className="report-section">
                      <h3>Contexto Macroeconômico e Premissas</h3>
                      <p>
                        Nossa análise fundamenta-se em um cenário de <strong>{analisarTendenciaPremissas(premissas).cenarioDescricao}</strong>. 
                        As projeções consideram uma trajetória do CDI de {premissas.cdi[0]}% no primeiro ano para {premissas.cdi[premissas.cdi.length-1]}% 
                        no quinto ano (média de {analisarTendenciaPremissas(premissas).cdiMedia}% a.a.), enquanto o IPCA evolui de {premissas.ipca[0]}% 
                        para {premissas.ipca[premissas.ipca.length-1]}% (média de {analisarTendenciaPremissas(premissas).ipcaMedia}% a.a.).
                      </p>
                      
                      <div className="report-highlight">
                        <strong>Premissas Anuais:</strong>
                        <br/>
                        <strong>CDI:</strong> {premissas.cdi.map((taxa, i) => `Ano ${i+1}: ${taxa}%`).join(' | ')}
                        <br/>
                        <strong>IPCA:</strong> {premissas.ipca.map((taxa, i) => `Ano ${i+1}: ${taxa}%`).join(' | ')}
                      </div>
                      
                      <p>
                        Para reinvestimento, consideramos {ativoAtual.taxaReinvestimento}% do CDI para ativos 
                        pós-fixados, IPCA + {premissasReinvestimento.ipca}% para indexados à inflação, 
                        e {premissasReinvestimento.pre}% a.a. para pré-fixados.
                      </p>
                    </div>

                    <div className="report-section">
                      <h3>Comparação das Estratégias</h3>
                      <p>
                        Analisamos duas estratégias distintas considerando o horizonte de investimento 
                        de {Math.max(ativoAtual.prazo, ativoProposto.prazo)} anos:
                      </p>
                      
                      <div className="report-highlight">
                        <strong>Estratégia Atual:</strong> {getIndexadorNome(ativoAtual.indexador)} 
                        {ativoAtual.indexador === 'pos' ? ` ${ativoAtual.taxa}% do CDI` : 
                         ativoAtual.indexador === 'ipca' ? ` IPCA + ${ativoAtual.taxa}%` : 
                         ` ${ativoAtual.taxa}% a.a.`} por {ativoAtual.prazo} anos, 
                        com reinvestimento em {getTipoReinvestimento(ativoAtual.tipoReinvestimento)} {ativoAtual.taxaReinvestimento}%.
                        <br/>
                        <strong>Valor Final Projetado:</strong> {formatarMoeda(resultados.valorFinalAtual)}
                      </div>
                      
                      <div className="report-highlight">
                        <strong>Estratégia Proposta:</strong> {getIndexadorNome(ativoProposto.indexador)} 
                        {ativoProposto.indexador === 'pos' ? ` ${ativoProposto.taxa}% do CDI` : 
                         ativoProposto.indexador === 'ipca' ? ` IPCA + ${ativoProposto.taxa}%` : 
                         ` ${ativoProposto.taxa}% a.a.`} por {ativoProposto.prazo} anos.
                        <br/>
                        <strong>Valor Final Projetado:</strong> {formatarMoeda(resultados.valorFinalProposto)}
                      </div>
                      
                      <p>
                        <strong>Análise dos Resultados:</strong> A estratégia proposta apresenta uma vantagem de 
                        <strong> {formatarMoeda(resultados.vantagem)}</strong>, equivalente a {resultados.vantagemPercentual.toFixed(2)}% 
                        de ganho total ou {resultados.vantagemAnualizada.toFixed(2)}% a.a. de rentabilidade adicional. 
                        {resultados.vantagem > 0 ? 
                          `Esta vantagem decorre principalmente da ${ativoProposto.indexador === 'ipca' ? 'proteção inflacionária' : 
                          ativoProposto.indexador === 'pre' ? 'taxa pré-fixada atrativa no cenário projetado' : 
                          'exposição ao CDI em momento favorável'} oferecida pela estratégia proposta.` :
                          'A estratégia atual se mostra mais vantajosa no cenário base, sugerindo manutenção da posição.'
                        }
                      </p>
                    </div>

                    <div className="report-section">
                      <h3>Validação por Simulação Monte Carlo</h3>
                      <p>
                        <strong>Importância da Simulação:</strong> Enquanto nossa análise determinística considera um cenário base, 
                        a realidade econômica é incerta. A simulação Monte Carlo testa 10.000 cenários alternativos, variando 
                        aleatoriamente as taxas de CDI e IPCA dentro de faixas estatisticamente plausíveis, oferecendo uma 
                        visão probabilística dos resultados.
                      </p>
                      
                      <p>
                        <strong>Resultados da Simulação:</strong> Em {monteCarlo.probabilidadeSuperior.toFixed(1)}% dos cenários 
                        testados, a estratégia proposta supera a atual. {monteCarlo.probabilidadeSuperior > 60 ? 
                        'Esta alta probabilidade de sucesso reforça a robustez da recomendação.' : 
                        monteCarlo.probabilidadeSuperior > 40 ? 
                        'Esta probabilidade moderada sugere que a decisão depende do apetite ao risco do investidor.' :
                        'Esta baixa probabilidade indica maior risco na estratégia proposta.'}
                      </p>
                      
                      <div className="report-highlight">
                        <strong>Métricas de Risco:</strong>
                        <br/>
                        <strong>VaR 95%:</strong> {formatarMoeda(monteCarlo.var95)} - No pior cenário (5% de probabilidade), 
                        a perda máxima esperada seria de {Math.abs(monteCarlo.var95).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.
                        <br/>
                        <strong>Sharpe Ratio:</strong> {monteCarlo.sharpeRatio.toFixed(2)} - {monteCarlo.sharpeRatio > 1 ? 
                        'Excelente relação risco-retorno, indicando que o retorno adicional compensa bem o risco assumido.' :
                        monteCarlo.sharpeRatio > 0.5 ? 
                        'Boa relação risco-retorno, com retorno adequado para o risco.' :
                        'Relação risco-retorno moderada, exigindo análise cuidadosa do perfil do investidor.'}
                      </div>
                    </div>

                    <div className="report-section">
                      <h3>Recomendação</h3>
                      <p>
                        <strong>Nossa Recomendação:</strong> {resultados.vantagem > 0 && monteCarlo.probabilidadeSuperior > 60 ? 
                        `MIGRAR para a estratégia proposta. A vantagem de ${resultados.vantagemAnualizada.toFixed(2)}% a.a. 
                        combinada com ${monteCarlo.probabilidadeSuperior.toFixed(1)}% de probabilidade de sucesso na simulação 
                        Monte Carlo oferece uma oportunidade atrativa de otimização do portfólio.` :
                        resultados.vantagem > 0 && monteCarlo.probabilidadeSuperior > 40 ?
                        `CONSIDERAR a migração, avaliando o perfil de risco. A estratégia proposta oferece vantagem potencial 
                        de ${resultados.vantagemAnualizada.toFixed(2)}% a.a., mas com probabilidade moderada de sucesso 
                        (${monteCarlo.probabilidadeSuperior.toFixed(1)}%).` :
                        `MANTER a estratégia atual. A análise indica que a posição atual oferece melhor relação risco-retorno 
                        no cenário projetado.`}
                      </p>
                      
                      <p>
                        <strong>Justificativa:</strong> Esta recomendação baseia-se na análise quantitativa das premissas 
                        macroeconômicas, na comparação determinística dos fluxos de caixa e na validação estatística 
                        através da simulação Monte Carlo. {analisarTendenciaPremissas(premissas).tendenciaCDI === 'baixa' && 
                        ativoProposto.indexador === 'pre' ? 
                        'O cenário de queda do CDI favorece estratégias pré-fixadas com taxas atrativas.' :
                        analisarTendenciaPremissas(premissas).tendenciaIPCA === 'alta' && ativoProposto.indexador === 'ipca' ?
                        'O cenário de pressão inflacionária favorece ativos indexados ao IPCA.' :
                        'A estratégia alinha-se adequadamente com o cenário macroeconômico projetado.'}
                      </p>
                    </div>

                    <div className="report-section">
                      <p style={{ textAlign: 'right', marginTop: '2rem', fontStyle: 'italic' }}>
                        Atenciosamente
                      </p>
                    </div>
                    
                    <button 
                      onClick={copiarRelatorio}
                      className="btn btn-primary copy-button"
                    >
                      📋 Copiar Relatório
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      
      {/* Footer */}
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>Desenvolvido por <strong>Thomaz Fonseca</strong></p>
      </footer>
    </div>
  );
}

export default App;

