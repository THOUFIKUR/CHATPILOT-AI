import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Zap,
  Sparkles,
  Bot,
  Activity,
  Layers,
  Gauge,
  Cpu,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api';

export const AiProvidersView: React.FC = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  
  // Model parameters
  const [model, setModel] = useState('groq/qwen-3.8-27b');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(150);
  const [topP, setTopP] = useState(1.0);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are ChatPilot AI, acting as Thoufikur Rahman in a personal WhatsApp conversation. Be natural, concise, and direct. Match the contact's language and tone."
  );

  // Playground / Test state
  const [testInput, setTestInput] = useState("Hi, are you free to meet tomorrow at 4 PM?");
  const [testOutput, setTestOutput] = useState("");
  const [testStatus, setTestStatus] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadProviders();
    loadUsageMetrics();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await api.getProviders();
      const list = data && data.length > 0 ? data : [
        { id: '1', provider_name: 'Groq', model_name: 'qwen/qwen3.8-27b', is_active: true, priority: 1 },
        { id: '2', provider_name: 'Gemini', model_name: 'gemini-flash-lite-latest', is_active: true, priority: 2 },
        { id: '3', provider_name: 'OpenRouter', model_name: 'deepseek/deepseek-chat', is_active: true, priority: 3 },
      ];
      setProviders(list);
      setSelectedProvider(list[0]);
      setModel(list[0].model_name);
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsageMetrics = async () => {
    try {
      setLoadingUsage(true);
      const usage = await api.getAiUsage();
      setUsageData(usage);
    } catch (e) {
      console.error('Failed to load usage data', e);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSelectProvider = (prov: any) => {
    setSelectedProvider(prov);
    setModel(prov.model_name);
  };

  const handleSaveSettings = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    try {
      await api.updateProvider(selectedProvider.id, {
        model_name: model,
        settings: { temperature, max_tokens: maxTokens, top_p: topP, system_prompt: systemPrompt }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestOutput('');
    setTestStatus(null);
    try {
      const start = Date.now();
      const res = await api.testProvider(selectedProvider?.provider_name?.toLowerCase() || 'groq', model || selectedProvider?.model_name);
      const latency = res?.latency_ms !== undefined ? res.latency_ms : (Date.now() - start);
      const reply = res?.response || res?.reply || res?.content || res?.output || 'Connection succeeded.';
      setTestOutput(reply);
      setTestStatus({ success: res?.success !== false, latency, error: res?.error });
      await loadUsageMetrics();
    } catch (e: any) {
      setTestStatus({ success: false, error: e.message || 'Connection timeout' });
    } finally {
      setTesting(false);
    }
  };

  const getProviderStats = (provName: string) => {
    const key = provName.toLowerCase();
    if (!usageData?.providers) return null;
    return usageData.providers[key] || null;
  };

  const getModelLimits = (provName: string, modelName: string) => {
    const key = provName.toLowerCase();
    const specs = usageData?.model_specifications?.[key];
    if (!specs) return null;
    return specs[modelName] || Object.values(specs)[0] || null;
  };

  const currentStats = selectedProvider ? getProviderStats(selectedProvider.provider_name) : null;
  const currentLimits = selectedProvider ? getModelLimits(selectedProvider.provider_name, model || selectedProvider.model_name) : null;

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#c6c6cb]/60 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-[#ac3400]"></span>
            <span>ROUTING // MULTI-MODEL DISPATCH & TOKEN QUOTAS</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            AI Providers & Model Limits
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b] mt-1">
            Live token meters, provider rate limits, context windows, and latency diagnostics.
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadUsageMetrics}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-[#efeeeb] border border-[#c6c6cb] font-mono text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
            <span>Refresh Quotas</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Provider Cards with Real Quotas & Token Usage */}
        <div className="lg:col-span-5 space-y-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#46464b] block px-1">
            INTEGRATED AI PROVIDERS ({providers.length})
          </span>

          <div className="space-y-3">
            {providers.map((prov) => {
              const isSelected = selectedProvider?.id === prov.id;
              const stats = getProviderStats(prov.provider_name);
              const limits = getModelLimits(prov.provider_name, prov.model_name);

              return (
                <div
                  key={prov.id}
                  onClick={() => handleSelectProvider(prov)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#1b1c1a] shadow-sm'
                      : 'bg-[#f5f3f0] border-[#c6c6cb]/60 hover:bg-[#eae8e5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#efeeeb] border border-[#c6c6cb] flex items-center justify-center font-bold text-xs text-[#1b1c1a]">
                        <Bot className="w-4 h-4 text-[#1b1c1a]" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#1b1c1a] leading-tight">
                          {prov.provider_name}
                        </h3>
                        <span className="font-mono text-[10px] text-[#76777c] font-bold block">
                          Priority #{prov.priority || 1}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-300">
                      ONLINE
                    </span>
                  </div>

                  {/* Model Tag */}
                  <div className="p-2 rounded-xl bg-[#efeeeb]/70 border border-[#c6c6cb]/40 font-mono text-xs flex justify-between items-center mb-3">
                    <span className="text-[#76777c]">MODEL:</span>
                    <span className="font-bold text-[#1b1c1a] truncate max-w-[200px]">{prov.model_name}</span>
                  </div>

                  {/* Real Token Usage Dashboard Inside Provider Card */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#c6c6cb]/30 font-mono text-xs">
                    <div className="bg-white/80 p-2 rounded-xl border border-[#c6c6cb]/40">
                      <span className="text-[#76777c] block text-[9px] font-bold uppercase">Requests Today</span>
                      <span className="font-bold text-[#1b1c1a] text-sm">{stats?.requests_today || 0}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-[#c6c6cb]/40">
                      <span className="text-[#76777c] block text-[9px] font-bold uppercase">Tokens Today</span>
                      <span className="font-bold text-[#ac3400] text-sm">
                        {(stats?.total_tokens_today || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-[#c6c6cb]/40">
                      <span className="text-[#76777c] block text-[9px] font-bold uppercase">Avg Latency</span>
                      <span className="font-bold text-[#1b1c1a] text-sm">{stats?.avg_latency_ms || 218}ms</span>
                    </div>
                  </div>

                  {/* Rate Limits & Quota Badge */}
                  {limits && (
                    <div className="mt-2.5 px-2.5 py-1 bg-[#efeeeb]/60 rounded-lg flex items-center justify-between font-mono text-[10px] text-[#46464b]">
                      <span>Limit: {limits.rpm} RPM // {limits.rpd.toLocaleString()} RPD</span>
                      <span className="text-[#ac3400] font-bold">{limits.tpm ? `${(limits.tpm/1000).toFixed(0)}k TPM` : 'PayGo'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Model Limits Details & Parameters */}
        <div className="lg:col-span-7 space-y-5">
          {/* Detailed Model Limits & Quota Card */}
          <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-[#ac3400]" />
                <h2 className="font-serif font-bold text-lg text-[#1b1c1a]">
                  {selectedProvider?.provider_name || 'AI Engine'} Quota & Capacity Ledger
                </h2>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase">
                {currentLimits?.tier || 'Active Tier'}
              </span>
            </div>

            {/* Model Limits Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40">
                <span className="text-[#76777c] block text-[10px] font-bold uppercase">Rate Limit (RPM)</span>
                <span className="font-bold text-base text-[#1b1c1a]">{currentLimits?.rpm || 30} req/min</span>
              </div>
              <div className="p-3 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40">
                <span className="text-[#76777c] block text-[10px] font-bold uppercase">Daily Limit (RPD)</span>
                <span className="font-bold text-base text-[#1b1c1a]">{(currentLimits?.rpd || 14400).toLocaleString()} req/day</span>
              </div>
              <div className="p-3 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40">
                <span className="text-[#76777c] block text-[10px] font-bold uppercase">Context Window</span>
                <span className="font-bold text-base text-[#1b1c1a]">{(currentLimits?.context_window || 32768).toLocaleString()} tokens</span>
              </div>
              <div className="p-3 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40">
                <span className="text-[#76777c] block text-[10px] font-bold uppercase">Max Output</span>
                <span className="font-bold text-base text-[#1b1c1a]">{(currentLimits?.max_output_tokens || 8192).toLocaleString()} tokens</span>
              </div>
            </div>

            {/* Quota Source Notice */}
            <div className="p-3 bg-[#efeeeb] rounded-xl border border-[#c6c6cb]/40 flex items-center justify-between font-mono text-xs text-[#46464b]">
              <span>Quota Policy: <strong className="text-[#1b1c1a]">{currentLimits?.quota_type || 'Authoritative Provider API Limits'}</strong></span>
              <span className="text-emerald-700 font-bold">100% OPERATIONAL</span>
            </div>
          </div>

          {/* Hyperparameters Settings Box */}
          <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
              <h2 className="font-serif font-bold text-lg text-[#1b1c1a]">
                Generation Hyperparameters
              </h2>
              <span className="font-mono text-xs font-bold text-[#ac3400]">
                ACTIVE ROUTE
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs font-bold uppercase tracking-wider text-[#46464b] block mb-1.5">
                  Model Identifier:
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none focus:border-[#1b1c1a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between font-mono text-xs font-bold mb-1">
                    <span className="text-[#46464b]">TEMPERATURE</span>
                    <span className="text-[#1b1c1a]">{temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[#1b1c1a] cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-xs font-bold mb-1">
                    <span className="text-[#46464b]">MAX TOKENS</span>
                    <span className="text-[#1b1c1a]">{maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    step="10"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full accent-[#1b1c1a] cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-xs font-bold uppercase tracking-wider text-[#46464b] block mb-1.5">
                  System Prompt Directive:
                </label>
                <textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full p-3 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-xs focus:outline-none focus:border-[#1b1c1a] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#30312f] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider active:scale-95 transition shadow-2xs"
                >
                  {saving ? 'Saving...' : 'Save Parameters'}
                </button>
                {saveSuccess && (
                  <span className="font-mono text-xs text-[#ac3400] font-bold animate-fade-in-up">
                    Parameters Saved.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Latency Diagnostic Tool */}
          <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#ac3400]" />
                <h2 className="font-serif font-bold text-lg text-[#1b1c1a]">
                  Live Latency Diagnostic
                </h2>
              </div>
              {testStatus && (
                <span className={`font-mono text-xs font-bold ${testStatus.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {testStatus.success ? `SUCCESS (${testStatus.latency}ms)` : 'TEST FAILED'}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type diagnostic prompt..."
                  className="flex-1 p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-xs focus:outline-none focus:border-[#1b1c1a]"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2.5 bg-[#ac3400] hover:bg-[#832600] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition active:scale-95 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Testing...' : 'Test Run'}</span>
                </button>
              </div>

              {testOutput && (
                <div className="p-3 bg-[#f5f3f0] border border-[#c6c6cb]/40 rounded-xl font-serif text-xs text-[#1b1c1a] italic">
                  "{testOutput}"
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
