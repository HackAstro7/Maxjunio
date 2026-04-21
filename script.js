// ========== CONFIGURAÇÕES E LINKS ==========
const CONFIG = {
    API_URL: 'https://www.iadouble.com.br/api/dados',
    CADASTRO_URL: 'https://7k.bet.br?ref=61e9227a88a4',
    TELEGRAM_URL: 'https://t.me/yasmindouble14x',
    WHATSAPP_URL: 'https://t.me/Diegosilva010',
    INSTAGRAM_URL: 'https://t.me/Diegosilva010',
    WHITE_LOGO: 'https://prod-double-new-be-o-br1.banana.games/assets/LOGO.da4d6216.svg',
    RED_LOGO: 'https://blaze.bet.br/images/roulette/red-0.svg',
    BLACK_LOGO: 'https://blaze.bet.br/images/roulette/black-0.svg'
};

// ========== VARIÁVEIS GLOBAIS ==========
let welcomeScreen;
let mainApp;
let historicalResults = [];
let historicalNumbers = [];
let historicalTimes = [];
let historicalIds = new Set();
let whiteHistory = [];
let lastWhiteTime = null;
let whiteCountToday = 0;
let lastWhiteDate = null;
let consecutiveLosses = 0;
let isProcessing = false;
let lastCheckHash = '';
let sistemaIniciado = false;

let currentSignal = { 
    active: false, 
    cor: null, 
    status: 'AGUARDANDO', 
    martingale: 0, 
    dataCompleta: null 
};

let signalsHistory = [];

let placar = { 
    win_primeira: 0, 
    win_gale1: 0, 
    win_branco: 0, 
    loss: 0, 
    consecutivas: 0, 
    max_consecutivas: 0, 
    sinais_hoje: 0 
};

let valorApostaBase = 10;
let soundEnabled = true;
let audioCtx = null;
let voiceEnabled = true;
let fetchInterval = null;

// ========== PADRÕES DE ANÁLISE ==========
const PADROES = [
    { pattern: ['P','V','V'], prediction: 'P', desc: '⬛🟥🟥 = ⬛' },
    { pattern: ['P','P','V'], prediction: 'P', desc: '⬛⬛🟥 = ⬛' },
    { pattern: ['V','V','V','P'], prediction: 'V', desc: '🟥🟥🟥⬛ = 🟥' },
    { pattern: ['P','P','P','V'], prediction: 'V', desc: '⬛⬛⬛🟥 = 🟥' },
    { pattern: ['V','P','V','P'], prediction: 'V', desc: '🟥⬛🟥⬛ = 🟥' },
    { pattern: ['P','V','P','V'], prediction: 'P', desc: '⬛🟥⬛🟥 = ⬛' },
    { pattern: ['V','V','P','P','V'], prediction: 'V', desc: '🟥🟥⬛⬛🟥 = 🟥' }
];

// ========== FUNÇÕES UTILITÁRIAS ==========
function formatarData() {
    let d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

function playSound() {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
        console.log('Erro no áudio:', e);
    }
}

function falar(mensagem) {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    let utterance = new SpeechSynthesisUtterance(mensagem);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

function getBestSignal(results) {
    for (let padrao of PADROES) {
        if (results.length >= padrao.pattern.length) {
            let match = true;
            for (let j = 0; j < padrao.pattern.length; j++) {
                if (results[j] !== padrao.pattern[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return { color: padrao.prediction, desc: padrao.desc };
        }
    }
    return null;
}

// ========== ATUALIZAÇÕES DE INTERFACE ==========
function atualizarPlacarDisplay() {
    document.getElementById('placarWinPrimeira').innerText = placar.win_primeira;
    document.getElementById('placarWinGale1').innerText = placar.win_gale1;
    document.getElementById('placarWinBranco').innerText = placar.win_branco;
    document.getElementById('placarLoss').innerText = placar.loss;
    document.getElementById('placarConsecutivas').innerText = placar.consecutivas;
    document.getElementById('placarMaximo').innerText = placar.max_consecutivas;
    document.getElementById('sinaisHoje').innerText = placar.sinais_hoje;
    
    let total = placar.win_primeira + placar.win_gale1 + placar.win_branco + placar.loss;
    let wins = placar.win_primeira + placar.win_gale1 + placar.win_branco;
    document.getElementById('placarAssertividade').innerText = total > 0 ? ((wins / total) * 100).toFixed(1) + '%' : '0%';
}

function atualizarSinalAtivo() {
    const container = document.getElementById('sinalContainer');
    const sinalLogo = document.getElementById('sinalLogo');
    const sinalLabel = document.getElementById('sinalLabel');
    const galeDiv = document.getElementById('galeStatus');
    
    if (currentSignal.active) {
        container.classList.add('sinal-ativo');
        sinalLogo.src = currentSignal.cor === 'V' ? CONFIG.RED_LOGO : CONFIG.BLACK_LOGO;
        sinalLabel.innerText = currentSignal.cor === 'V' ? 'VERMELHO' : 'PRETO';
        
        if (currentSignal.martingale === 1 && currentSignal.status === 'AGUARDANDO') {
            galeDiv.style.display = 'inline-block';
            galeDiv.className = 'gale-status gale-primeira';
            galeDiv.innerText = '⚠️ GALE 1 - RECUPERAÇÃO';
        } else {
            galeDiv.style.display = 'none';
        }
        
        if (currentSignal.status === 'WIN' || currentSignal.status === 'LOSS') {
            document.getElementById('sinalResultado').style.display = 'block';
            let txt = document.getElementById('resultadoTexto');
            txt.innerText = currentSignal.status === 'WIN' ? '✅ WIN' : '❌ LOSS';
            txt.className = `sinal-resultado ${currentSignal.status === 'WIN' ? 'resultado-win' : 'resultado-loss'}`;
            document.getElementById('sinalStatusDisplay').innerText = 'FINALIZADO';
        } else {
            document.getElementById('sinalResultado').style.display = 'none';
            document.getElementById('sinalStatusDisplay').innerText = 'AGUARDANDO RESULTADO';
        }
    } else {
        container.classList.remove('sinal-ativo');
    }
}

function atualizarHistoricoSinais() {
    const container = document.getElementById('historicoSinais');
    container.innerHTML = signalsHistory.slice().reverse().map(s => {
        const isWin = s.resultado.includes('WIN');
        const isBranco = s.resultado.includes('BRANCO');
        
        return `
            <div class="historico-item">
                <div class="historico-data">📅 ${s.dataCompleta}</div>
                <div class="historico-resultado">
                    <div class="cor-sinal ${s.cor === 'V' ? 'vermelho' : 'preto'}"></div>
                    <div class="sinal-resultado ${isBranco ? 'resultado-win-branco' : (isWin ? 'resultado-win' : 'resultado-loss')}">
                        ${isWin ? '✅ WIN' : '❌ LOSS'}
                        ${isBranco ? ' (PROTEÇÃO)' : ''}
                    </div>
                </div>
                ${isBranco ? '<div class="protecao-badge">🛡️ PROTEÇÃO BRANCO</div>' : ''}
            </div>
        `;
    }).join('');
}

// ========== NOTIFICAÇÕES ==========
function mostrarNotificacao(cor) {
    playSound();
    falar(`Novo sinal ${cor === 'V' ? 'VERMELHO' : 'PRETO'}`);
}

function mostrarNotificacaoWin(cor, martingale) {
    falar(`Vitória no sinal ${cor === 'V' ? 'vermelho' : 'preto'} ${martingale === 0 ? 'entrada' : 'Gale 1'}`);
}

function mostrarNotificacaoLoss(cor) {
    falar(`Perda total no sinal ${cor === 'V' ? 'vermelho' : 'preto'}.`);
}

function mostrarNotificacaoProtecao(cor) {
    falar(`Proteção ativada! Saiu Branco. Vitória garantida.`);
}

// ========== GESTÃO DE BANCA ==========
function registrarMovimento(valor, desc) {
    let bancaAtual = parseFloat(localStorage.getItem('bancaAtual') || '100');
    bancaAtual += valor;
    if (bancaAtual < 0) return;
    
    localStorage.setItem('bancaAtual', bancaAtual);
    if (!localStorage.getItem('bancaInicial')) {
        localStorage.setItem('bancaInicial', '100');
    }
    
    document.getElementById('bancaAtualDisplay').innerHTML = `R$ ${bancaAtual.toFixed(2)}`;
    let lucro = bancaAtual - parseFloat(localStorage.getItem('bancaInicial') || '100');
    document.getElementById('lucroTotal').innerHTML = `${lucro >= 0 ? '+' : ''}R$ ${lucro.toFixed(2)}`;
    
    const historicoDiv = document.getElementById('historicoMovimentos');
    const movimento = document.createElement('div');
    movimento.style.padding = '5px';
    movimento.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    movimento.innerHTML = `<small>${formatarData()}</small><br>${desc}: ${valor >= 0 ? '+' : ''}R$ ${valor.toFixed(2)}`;
    historicoDiv.insertBefore(movimento, historicoDiv.firstChild);
}

// ========== FETCH DE DADOS ==========
async function fetchData() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        const resp = await fetch(CONFIG.API_URL);
        const data = await resp.json();
        const recovery = data.results;
        const newHash = JSON.stringify(recovery.map(r => r.id));
        
        if (newHash === lastCheckHash) {
            isProcessing = false;
            return;
        }
        lastCheckHash = newHash;
        
        let novos = 0;
        let ultimo = null;
        
        for (let i = recovery.length - 1; i >= 0; i--) {
            const item = recovery[i];
            if (!historicalIds.has(item.id)) {
                if (item.color === 'B') {
                    lastWhiteTime = new Date();
                    whiteHistory.push(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
                    if (whiteHistory.length > 17) whiteHistory.shift();
                    
                    let hoje = new Date().toDateString();
                    if (lastWhiteDate !== hoje) {
                        whiteCountToday = 1;
                        lastWhiteDate = hoje;
                    } else {
                        whiteCountToday++;
                    }
                }
                
                historicalResults.unshift(item.color);
                historicalNumbers.unshift(item.number);
                historicalTimes.unshift(item.created_at ? new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--');
                historicalIds.add(item.id);
                novos++;
                ultimo = { cor: item.color };
            }
        }
        
        if (novos > 0) {
            let gradeHtml = '';
            for (let i = 0; i < Math.min(historicalResults.length, 600); i++) {
                let inner = '<div class="resultado-container"><div class="resultado-quadrado ';
                if (historicalResults[i] === 'B') {
                    inner += `white"><img src="${CONFIG.WHITE_LOGO}" alt="B"></div>`;
                } else if (historicalResults[i] === 'V') {
                    inner += `red">${historicalNumbers[i]}</div>`;
                } else {
                    inner += `black">${historicalNumbers[i]}</div>`;
                }
                inner += `<div class="resultado-hora">${historicalTimes[i] || '--:--'}</div></div>`;
                gradeHtml += inner;
            }
            document.getElementById('resultados-grade').innerHTML = gradeHtml || '<div>Sem dados</div>';
            
            let jogosSemBranco = 0;
            for (let i = 0; i < historicalResults.length; i++) {
                if (historicalResults[i] === 'B') break;
                jogosSemBranco++;
            }
            document.getElementById('contadorBrancoCasas').innerText = jogosSemBranco;
            
            if (lastWhiteTime) {
                document.getElementById('contadorBrancoMinutos').innerText = Math.floor((new Date() - lastWhiteTime) / 60000);
            }
            document.getElementById('totalBrancosHoje').innerText = whiteCountToday;
            
            let histBrancoHtml = '';
            whiteHistory.slice(-17).reverse().forEach(t => {
                histBrancoHtml += `<div class="branco-card"><img src="${CONFIG.WHITE_LOGO}" alt="B"><span>${t}</span></div>`;
            });
            document.getElementById('historicoBrancos').innerHTML = histBrancoHtml || '<span>Nenhum Branco</span>';
            
            if (ultimo && currentSignal.active && currentSignal.status === 'AGUARDANDO') {
                if (ultimo.cor === 'B') {
                    currentSignal.status = 'WIN';
                    placar.win_branco++;
                    placar.consecutivas++;
                    consecutiveLosses = 0;
                    if (placar.consecutivas > placar.max_consecutivas) placar.max_consecutivas = placar.consecutivas;
                    
                    signalsHistory.push({ cor: currentSignal.cor, dataCompleta: formatarData(), resultado: 'WIN (BRANCO)' });
                    atualizarHistoricoSinais();
                    mostrarNotificacaoProtecao(currentSignal.cor);
                    registrarMovimento(valorApostaBase, 'WIN PROTEÇÃO');
                    currentSignal.active = false;
                    atualizarSinalAtivo();
                    
                } else if (ultimo.cor === currentSignal.cor) {
                    currentSignal.status = 'WIN';
                    if (currentSignal.martingale === 0) placar.win_primeira++;
                    else if (currentSignal.martingale === 1) placar.win_gale1++;
                    
                    placar.consecutivas++;
                    consecutiveLosses = 0;
                    if (placar.consecutivas > placar.max_consecutivas) placar.max_consecutivas = placar.consecutivas;
                    
                    signalsHistory.push({ cor: currentSignal.cor, dataCompleta: formatarData(), resultado: 'WIN' });
                    atualizarHistoricoSinais();
                    mostrarNotificacaoWin(currentSignal.cor, currentSignal.martingale);
                    
                    let valorOp = valorApostaBase * (currentSignal.martingale === 0 ? 1 : 2);
                    registrarMovimento(valorOp, `WIN ${currentSignal.cor === 'V' ? 'VERMELHO' : 'PRETO'} ${currentSignal.martingale === 0 ? 'Entrada' : 'Gale1'}`);
                    currentSignal.active = false;
                    atualizarSinalAtivo();
                    
                } else {
                    if (currentSignal.martingale < 1) {
                        currentSignal.martingale = 1;
                        falar(`Sinal perdeu. Entrando no GALE 1 para ${currentSignal.cor === 'V' ? 'vermelho' : 'preto'}`);
                        atualizarSinalAtivo();
                    } else {
                        currentSignal.status = 'LOSS';
                        placar.loss++;
                        placar.consecutivas = 0;
                        consecutiveLosses++;
                        
                        signalsHistory.push({ cor: currentSignal.cor, dataCompleta: formatarData(), resultado: 'LOSS' });
                        atualizarHistoricoSinais();
                        mostrarNotificacaoLoss(currentSignal.cor);
                        registrarMovimento(-(valorApostaBase * 2), `LOSS ${currentSignal.cor === 'V' ? 'VERMELHO' : 'PRETO'} Gale1`);
                        currentSignal.active = false;
                        atualizarSinalAtivo();
                    }
                }
                atualizarPlacarDisplay();
                atualizarSinalAtivo();
            }
            
            if (!currentSignal.active || currentSignal.status !== 'AGUARDANDO') {
                const best = getBestSignal(historicalResults);
                if (best) {
                    currentSignal = {
                        active: true,
                        cor: best.color,
                        dataCompleta: formatarData(),
                        martingale: 0,
                        status: 'AGUARDANDO'
                    };
                    placar.sinais_hoje++;
                    atualizarPlacarDisplay();
                    atualizarSinalAtivo();
                    mostrarNotificacao(best.color);
                }
            }
        }
        
        document.getElementById('statusRobo').innerText = 'ONLINE';
        
    } catch (e) {
        console.error('Erro na API:', e);
        document.getElementById('statusRobo').innerText = 'OFFLINE';
    } finally {
        isProcessing = false;
    }
}

// ========== INICIALIZAÇÃO ==========
function iniciarSistemaRobo() {
    if (sistemaIniciado) return;
    sistemaIniciado = true;
    
    console.log('🚀 Sistema IA Hacker iniciado!');
    
    // Iniciar fetch de dados
    fetchData();
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(fetchData, 3000);
    
    // Atualizar hora
    setInterval(() => {
        const horaElement = document.getElementById('horaAtual');
        if (horaElement) {
            horaElement.innerText = new Date().toLocaleTimeString('pt-BR');
        }
    }, 1000);
    
    // Configurar botão de atualizar
    document.getElementById('btnAtualizar').onclick = () => fetchData();
    
    // Inicializar banca
    if (!localStorage.getItem('bancaAtual')) localStorage.setItem('bancaAtual', '100');
    if (!localStorage.getItem('bancaInicial')) localStorage.setItem('bancaInicial', '100');
    document.getElementById('bancaAtualDisplay').innerHTML = `R$ ${parseFloat(localStorage.getItem('bancaAtual')).toFixed(2)}`;
    
    // Configurar modal de banca
    document.getElementById('btnAbrirBanca').onclick = () => {
        document.getElementById('modalBanca').classList.add('active');
    };
    
    document.getElementById('fecharModal').onclick = () => {
        document.getElementById('modalBanca').classList.remove('active');
    };
    
    document.getElementById('btnResetarBanca').onclick = () => {
        if (confirm('Resetar banca para o valor inicial?')) {
            localStorage.setItem('bancaAtual', localStorage.getItem('bancaInicial'));
            location.reload();
        }
    };
    
    document.getElementById('btnAdicionarMovimento').onclick = () => {
        let v = parseFloat(document.getElementById('valorMovimento').value);
        if (!isNaN(v)) {
            let atual = parseFloat(localStorage.getItem('bancaAtual'));
            localStorage.setItem('bancaAtual', atual + v);
            location.reload();
        }
    };
    
    // Criar controle de voz
    const voiceDiv = document.createElement('div');
    voiceDiv.className = 'voice-control active';
    voiceDiv.innerHTML = '<i class="fas fa-microphone-alt"></i>';
    document.body.appendChild(voiceDiv);
    
    voiceDiv.onclick = () => {
        voiceEnabled = !voiceEnabled;
        voiceDiv.classList.toggle('active');
        falar(voiceEnabled ? 'Voz ativada' : 'Voz desativada');
    };
    
    // Controle de som
    document.getElementById('soundControl').onclick = () => {
        soundEnabled = !soundEnabled;
        document.getElementById('soundIcon').className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    };
    
    // Fechar modal ao clicar fora
    document.getElementById('modalBanca').addEventListener('click', (e) => {
        if (e.target.id === 'modalBanca') {
            document.getElementById('modalBanca').classList.remove('active');
        }
    });
}

// ========== INICIALIZAÇÃO DOS BOTÕES ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM carregado - Configurando botões...');
    
    welcomeScreen = document.getElementById('welcomeScreen');
    mainApp = document.getElementById('mainApp');
    
    // Botão CRIAR CONTA - Abre em nova aba
    const btnCriarConta = document.getElementById('btnCriarConta');
    if (btnCriarConta) {
        btnCriarConta.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔗 Abrindo cadastro:', CONFIG.CADASTRO_URL);
            window.open(CONFIG.CADASTRO_URL, '_blank');
        });
    }
    
    // Botão ACESSAR DOUBLE MAX - Esconde welcome e mostra app
    const btnAcessarDouble = document.getElementById('btnAcessarDouble');
    if (btnAcessarDouble) {
        btnAcessarDouble.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎮 Acessando Double Max...');
            
            // Esconder tela de boas-vindas
            if (welcomeScreen) {
                welcomeScreen.style.display = 'none';
            }
            
            // Mostrar aplicativo principal
            if (mainApp) {
                mainApp.classList.add('visible');
            }
            
            // Iniciar o sistema
            iniciarSistemaRobo();
        });
    }
    
    console.log('✅ Sistema pronto! Clique em "ACESSAR DOUBLE MAX" para começar.');
});
