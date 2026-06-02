import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, Loader2, Moon, Sun, User as UserIcon, Globe, DollarSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePreferences } from '@/features/settings/PreferencesContext';
import { LANGUAGES, SUPPORTED_LANGUAGES } from '@/shared/i18n';
import { CURRENCIES, SUPPORTED_CURRENCIES } from '@/shared/lib/money';

function FieldLabel({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />} {children}
    </label>
  );
}

export default function SettingsModal({ onClose }) {
  const { user, checkUserAuth } = useAuth();
  const { language, currency, theme, setLanguage, setCurrency, setTheme, t } = usePreferences();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handleAvatar = async (file) => {
    if (!file || !user?.id) return;
    setEnviando(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
      if (updErr) throw updErr;
      await checkUserAuth();
      toast({ title: 'Foto atualizada!' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível enviar a foto', description: err?.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/40 max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">{t('settings.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Perfil */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">{t('settings.profile')}</p>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#EA3935]/15 border border-[#EA3935]/40 flex items-center justify-center text-white text-xl font-semibold">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : initials}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={enviando}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#EA3935] hover:bg-[#C12D29] text-white flex items-center justify-center shadow-md disabled:opacity-60"
                  title={t('settings.changePhoto')}
                >
                  {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleAvatar(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Preferências */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">{t('settings.preferences')}</p>
            <div className="space-y-4">
              {/* Idioma */}
              <div>
                <FieldLabel icon={Globe}>{t('settings.language')}</FieldLabel>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>{LANGUAGES[l].flag} {LANGUAGES[l].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Moeda */}
              <div>
                <FieldLabel icon={DollarSign}>{t('settings.currency')}</FieldLabel>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{CURRENCIES[c].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currency !== 'BRL' && (
                  <p className="text-[10px] text-muted-foreground mt-1">Valores convertidos pela cotação atual (base: BRL).</p>
                )}
              </div>

              {/* Tema */}
              <div>
                <FieldLabel icon={UserIcon}>{t('settings.theme')}</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm transition-colors ${theme === 'dark' ? 'bg-[#EA3935]/15 border-[#EA3935]/40 text-white' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'}`}
                  >
                    <Moon className="w-4 h-4" /> {t('settings.themeDark')}
                    {theme === 'dark' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm transition-colors ${theme === 'light' ? 'bg-[#EA3935]/15 border-[#EA3935]/40 text-white' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white'}`}
                  >
                    <Sun className="w-4 h-4" /> {t('settings.themeLight')}
                    {theme === 'light' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 pt-1">
          <Button onClick={onClose} className="w-full bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10">
            {t('settings.cancel')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
