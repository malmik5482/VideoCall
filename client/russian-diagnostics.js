// ========== RUSSIAN NETWORK DIAGNOSTICS MODULE ==========
// Специализированные функции для работы в российских условиях

class RussianNetworkDiagnostics {
  constructor() {
    this.diagnostics = {
      connectionType: 'unknown',
      effectiveSpeed: 0,
      rtt: 0,
      packetLoss: 0,
      networkQuality: 'unknown',
      vpnDetected: false,
      mobileDetected: false,
      turnRequired: false
    };
    
    this.diagnosticHistory = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  // Определение типа российского провайдера по IP/сети
  detectRussianProvider() {
    const providers = {
      rostelecom: ['rostelecom', 'rt.ru', 'south.rt.ru'],
      mts: ['mts.ru', 'mts', 'mtsbank'],
      beeline: ['beeline.ru', 'corbina.ru'],
      megafon: ['megafon.ru', 'megafon'],
      tele2: ['tele2.ru', 'tele2'],
      yota: ['yota.ru', 'yota'],
      sknt: ['sknt.ru'],
      tattelecom: ['tattelecom.ru']
    };

    // Попробуем определить провайдера через connection API
    if ('connection' in navigator && navigator.connection.type) {
      const connectionType = navigator.connection.type.toLowerCase();
      
      for (const [provider, domains] of Object.entries(providers)) {
        if (domains.some(domain => connectionType.includes(domain))) {
          return provider;
        }
      }
    }

    return 'unknown';
  }

  // Определение использования VPN
  async detectVPNUsage() {
    try {
      // Проверяем через WebRTC утечку IP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const localIPs = [];
      
      pc.createDataChannel('');
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return new Promise((resolve) => {
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          
          const candidate = ice.candidate.candidate;
          const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
          
          if (ipMatch) {
            const ip = ipMatch[1];
            if (localIPs.indexOf(ip) === -1) {
              localIPs.push(ip);
            }
          }
          
          // Анализируем собранные IP
          const hasPrivateIP = localIPs.some(ip => 
            ip.startsWith('192.168.') || 
            ip.startsWith('10.') || 
            ip.startsWith('172.')
          );
          
          const hasPublicIP = localIPs.some(ip => 
            !ip.startsWith('192.168.') && 
            !ip.startsWith('10.') && 
            !ip.startsWith('172.') &&
            !ip.startsWith('127.')
          );

          // Если есть только публичные IP или странные комбинации - возможно VPN
          const vpnSuspicious = !hasPrivateIP || localIPs.length > 3;
          
          setTimeout(() => {
            pc.close();
            resolve({
              detected: vpnSuspicious,
              confidence: vpnSuspicious ? 0.7 : 0.3,
              ips: localIPs
            });
          }, 2000);
        };
      });
    } catch (error) {
      console.warn('VPN detection failed:', error);
      return { detected: false, confidence: 0, ips: [] };
    }
  }

  // Тест скорости соединения (упрощенный для российских условий)
  async measureConnectionSpeed() {
    const testSizes = [100, 500, 1000]; // KB
    const testResults = [];

    for (const size of testSizes) {
      try {
        const startTime = Date.now();
        
        // Создаем тестовую нагрузку
        const testData = new Array(size * 1024).fill('x').join('');
        const blob = new Blob([testData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Загружаем данные через fetch
        const response = await fetch(url);
        await response.text();
        
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        const speedKbps = (size * 8) / (durationMs / 1000); // kbit/s
        
        testResults.push(speedKbps);
        URL.revokeObjectURL(url);
        
      } catch (error) {
        console.warn(`Speed test failed for ${size}KB:`, error);
      }
    }

    if (testResults.length === 0) return 0;
    
    // Возвращаем медианную скорость
    testResults.sort((a, b) => a - b);
    return testResults[Math.floor(testResults.length / 2)];
  }

  // Тест качества соединения с российскими серверами
  async testRussianServerLatency() {
    const russianServers = [
      'ya.ru',
      'mail.ru',
      'vk.com',
      'sberbank.ru',
      'rt.ru'
    ];

    const latencyResults = [];

    for (const server of russianServers) {
      try {
        const startTime = Date.now();
        
        // Используем image loading для теста latency (обходит CORS)
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = `https://${server}/favicon.ico?t=${Date.now()}`;
          
          setTimeout(reject, 5000); // 5 секунд таймаут
        });
        
        const latency = Date.now() - startTime;
        latencyResults.push(latency);
        
      } catch (error) {
        console.warn(`Latency test failed for ${server}:`, error);
      }
    }

    if (latencyResults.length === 0) return 999;
    
    // Возвращаем медианную latency
    latencyResults.sort((a, b) => a - b);
    return latencyResults[Math.floor(latencyResults.length / 2)];
  }

  // Комплексная диагностика российской сети
  async performCompleteDiagnostics() {
    console.log('🔍 Starting Russian network diagnostics...');
    
    const startTime = Date.now();
    
    try {
      // 1. Определяем базовые параметры сети
      if ('connection' in navigator) {
        const conn = navigator.connection;
        this.diagnostics.effectiveSpeed = conn.downlink || 0;
        this.diagnostics.connectionType = conn.effectiveType || 'unknown';
      }

      // 2. Определяем мобильное устройство
      this.diagnostics.mobileDetected = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 3. Тестируем VPN
      const vpnTest = await this.detectVPNUsage();
      this.diagnostics.vpnDetected = vpnTest.detected;

      // 4. Измеряем latency к российским серверам
      this.diagnostics.rtt = await this.testRussianServerLatency();

      // 5. Определяем провайдера
      this.diagnostics.provider = this.detectRussianProvider();

      // 6. Оценка качества сети
      this.evaluateNetworkQuality();

      // 7. Определяем необходимость TURN
      this.determineTurnRequirement();

      const diagnosticTime = Date.now() - startTime;
      console.log(`✅ Diagnostics completed in ${diagnosticTime}ms:`, this.diagnostics);

      // Сохраняем в историю
      this.diagnosticHistory.push({
        timestamp: Date.now(),
        results: { ...this.diagnostics },
        duration: diagnosticTime
      });

      // Ограничиваем историю
      if (this.diagnosticHistory.length > 10) {
        this.diagnosticHistory = this.diagnosticHistory.slice(-10);
      }

      return this.diagnostics;
      
    } catch (error) {
      console.error('Diagnostics failed:', error);
      return this.diagnostics;
    }
  }

  // Оценка качества сети на основе российских условий
  evaluateNetworkQuality() {
    let qualityScore = 0;

    // Оценка по скорости
    if (this.diagnostics.effectiveSpeed > 50) qualityScore += 30;
    else if (this.diagnostics.effectiveSpeed > 10) qualityScore += 20;
    else if (this.diagnostics.effectiveSpeed > 1) qualityScore += 10;

    // Оценка по latency
    if (this.diagnostics.rtt < 50) qualityScore += 30;
    else if (this.diagnostics.rtt < 100) qualityScore += 20;
    else if (this.diagnostics.rtt < 200) qualityScore += 10;

    // Штрафы за проблемные условия
    if (this.diagnostics.vpnDetected) qualityScore -= 15; // VPN ухудшает соединение
    if (this.diagnostics.mobileDetected) qualityScore -= 10; // Мобильная сеть менее стабильна

    // Определяем итоговое качество
    if (qualityScore >= 50) this.diagnostics.networkQuality = 'excellent';
    else if (qualityScore >= 35) this.diagnostics.networkQuality = 'good';
    else if (qualityScore >= 20) this.diagnostics.networkQuality = 'fair';
    else this.diagnostics.networkQuality = 'poor';
  }

  // Определение необходимости использования TURN сервера
  determineTurnRequirement() {
    let turnScore = 0;

    // Факторы, увеличивающие потребность в TURN
    if (this.diagnostics.mobileDetected) turnScore += 30;
    if (this.diagnostics.vpnDetected) turnScore += 25;
    if (this.diagnostics.rtt > 200) turnScore += 20;
    if (this.diagnostics.networkQuality === 'poor') turnScore += 30;
    if (this.diagnostics.provider === 'unknown') turnScore += 15;

    // Российские операторы с известными проблемами NAT
    const problematicProviders = ['mts', 'tele2', 'yota'];
    if (problematicProviders.includes(this.diagnostics.provider)) {
      turnScore += 20;
    }

    this.diagnostics.turnRequired = turnScore > 40;
    this.diagnostics.turnPriority = turnScore > 60 ? 'high' : turnScore > 40 ? 'medium' : 'low';
  }

  // Рекомендации для улучшения соединения
  getOptimizationRecommendations() {
    const recommendations = [];

    if (this.diagnostics.mobileDetected) {
      recommendations.push({
        type: 'network',
        priority: 'high',
        title: 'Мобильная сеть',
        description: 'Рекомендуется подключение к WiFi для лучшего качества',
        action: 'Переключитесь на WiFi если возможно'
      });
    }

    if (this.diagnostics.vpnDetected) {
      recommendations.push({
        type: 'vpn',
        priority: 'medium',
        title: 'VPN обнаружен',
        description: 'VPN может влиять на качество соединения',
        action: 'При проблемах попробуйте отключить VPN'
      });
    }

    if (this.diagnostics.rtt > 200) {
      recommendations.push({
        type: 'latency',
        priority: 'high',
        title: 'Высокая задержка',
        description: `Задержка ${this.diagnostics.rtt}ms слишком высокая`,
        action: 'Проверьте загруженность сети и закройте другие приложения'
      });
    }

    if (this.diagnostics.turnRequired) {
      recommendations.push({
        type: 'turn',
        priority: 'high',
        title: 'Требуется TURN сервер',
        description: 'Ваша сеть требует использования TURN сервера',
        action: 'TURN сервер будет использован автоматически'
      });
    }

    if (this.diagnostics.effectiveSpeed < 1) {
      recommendations.push({
        type: 'speed',
        priority: 'critical',
        title: 'Низкая скорость',
        description: 'Скорость интернета недостаточна для видеозвонков',
        action: 'Проверьте подключение к интернету'
      });
    }

    return recommendations;
  }

  // Начать мониторинг в реальном времени
  startContinuousMonitoring(callback, interval = 30000) {
    if (this.isMonitoring) {
      this.stopContinuousMonitoring();
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      const results = await this.performCompleteDiagnostics();
      if (callback && typeof callback === 'function') {
        callback(results);
      }
    }, interval);

    console.log('🔄 Started continuous network monitoring');
  }

  // Остановить мониторинг
  stopContinuousMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Stopped continuous network monitoring');
  }

  // Экспорт диагностических данных
  exportDiagnosticsReport() {
    const report = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      current: this.diagnostics,
      history: this.diagnosticHistory,
      recommendations: this.getOptimizationRecommendations(),
      metadata: {
        version: '1.0.0',
        region: 'Russia',
        optimized: true
      }
    };

    return report;
  }
}

// Экспортируем класс для использования в основном приложении
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RussianNetworkDiagnostics;
} else if (typeof window !== 'undefined') {
  window.RussianNetworkDiagnostics = RussianNetworkDiagnostics;
}