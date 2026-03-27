import type { Metadata } from "next";
import {
  Search,
  Globe,
  Brain,
  FileText,
  MessageSquare,
  Mail,
  PenTool,
  BarChart3,
  Zap,
  Server,
  ShieldCheck,
  ChevronRight,
  Lock,
  Database,
  ArrowLeft,
  Sparkles,
  Target,
  GitBranch,
  Code,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About — JobFinder",
  description:
    "Open-source, self-hosted AI-powered job search automation. Find, score, and apply to jobs automatically.",
};

/* ------------------------------------------------------------------ */
/* Language switcher (client island)                                    */
/* ------------------------------------------------------------------ */

function LangSwitcher() {
  return (
    <div className="lang-switch" id="langSwitch">
      <button className="lang-btn active" data-lang="en">
        EN
      </button>
      <button className="lang-btn" data-lang="ua">
        UA
      </button>
      <button className="lang-btn" data-lang="es">
        ES
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trilingual text helper                                              */
/* ------------------------------------------------------------------ */

function T({
  en,
  ua,
  es,
  as: Tag = "span",
  className,
}: {
  en: string;
  ua: string;
  es: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}) {
  return (
    <Tag className={className} data-en={en} data-ua={ua} data-es={es}>
      {en}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Feature card                                                        */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon,
  titleEn,
  titleUa,
  titleEs,
  descEn,
  descUa,
  descEs,
}: {
  icon: React.ReactNode;
  titleEn: string;
  titleUa: string;
  titleEs: string;
  descEn: string;
  descUa: string;
  descEs: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-blue-400/30 hover:bg-white/[0.04]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        {icon}
      </div>
      <T
        as="h3"
        en={titleEn}
        ua={titleUa}
        es={titleEs}
        className="mb-2 text-lg font-semibold text-white"
      />
      <T
        as="p"
        en={descEn}
        ua={descUa}
        es={descEs}
        className="text-sm leading-relaxed text-[#9a9ea6]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tech badge                                                          */
/* ------------------------------------------------------------------ */

function TechBadge({
  icon,
  name,
}: {
  icon: React.ReactNode;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-[#9a9ea6]">
      {icon}
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Platform badge                                                      */
/* ------------------------------------------------------------------ */

function PlatformBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#9a9ea6] transition-colors hover:border-blue-400/30 hover:text-white">
      <Globe className="h-3 w-3 text-blue-400/60" />
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  return (
    <>
      {/* Inline script for language switching — runs client-side */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  function setLang(lang) {
    document.querySelectorAll('[data-' + lang + ']').forEach(function(el) {
      var text = el.getAttribute('data-' + lang);
      if (text) el.innerHTML = text;
    });
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    document.documentElement.lang = lang === 'ua' ? 'uk' : lang === 'es' ? 'es' : 'en';
    localStorage.setItem('jf-about-lang', lang);
  }
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.lang-btn');
    if (btn) setLang(btn.getAttribute('data-lang'));
  });
  var saved = localStorage.getItem('jf-about-lang');
  if (saved && saved !== 'en') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setLang(saved); });
    } else { setLang(saved); }
  }
})();
          `,
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
.lang-switch {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 50;
  display: flex;
  gap: 2px;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.05);
  padding: 3px;
  backdrop-filter: blur(12px);
}
.lang-btn {
  padding: 4px 14px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
}
.lang-btn:hover { color: rgba(255,255,255,0.8); }
.lang-btn.active {
  background: rgba(59,130,246,0.2);
  color: rgb(96,165,250);
}
          `,
        }}
      />

      <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-blue-500/20">
        {/* Language Switcher */}
        <LangSwitcher />

        {/* Back to login */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-6">
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <T en="Back to login" ua="Назад до входу" es="Volver al inicio" />
          </a>
        </div>

        {/* ==================== HERO ==================== */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8">
          {/* Gradient glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/[0.06] blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Logo */}
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-lg shadow-black/20">
              <span className="text-3xl font-bold bg-gradient-to-br from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                JF
              </span>
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Job
              </span>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Finder
              </span>
            </h1>

            <T
              as="p"
              en="Your job search, automated."
              ua="Пошук роботи на автопілоті."
              es="Tu busqueda de empleo, automatizada."
              className="mb-8 text-lg text-[#9a9ea6] sm:text-xl"
            />

            {/* Badges */}
            <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
              {[
                {
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                  en: "AI-Powered",
                  ua: "На базi ШI",
                  es: "Con IA",
                },
                {
                  icon: <Server className="h-3.5 w-3.5" />,
                  en: "Self-Hosted",
                  ua: "Самохостинг",
                  es: "Autoalojado",
                },
                {
                  icon: <ShieldCheck className="h-3.5 w-3.5" />,
                  en: "Privacy-First",
                  ua: "Приватність",
                  es: "Privacidad",
                },
                {
                  icon: <Code className="h-3.5 w-3.5" />,
                  en: "Open Source",
                  ua: "Відкритий код",
                  es: "Codigo abierto",
                },
              ].map((b) => (
                <span
                  key={b.en}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/[0.06] px-4 py-1.5 text-sm font-medium text-blue-400"
                >
                  {b.icon}
                  <T en={b.en} ua={b.ua} es={b.es} />
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:brightness-110"
              >
                <T en="Get Started" ua="Почати" es="Empezar" />
                <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-400 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20"
              >
                <Sparkles className="h-4 w-4" />
                <T en="Try Demo" ua="Демо" es="Probar Demo" />
              </a>
              <a
                href="https://github.com/tarascloud/JobFinder"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.06]"
              >
                <GitBranch className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ==================== FEATURES ==================== */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <T
                as="h2"
                en="Everything you need, from resume to offer"
                ua="Все що потрібно — від резюме до офера"
                es="Todo lo que necesitas, del CV a la oferta"
                className="mb-3 text-3xl font-bold sm:text-4xl"
              />
              <T
                as="p"
                en="9 modules that automate every step of your job search."
                ua="9 модулів, що автоматизують кожен крок пошуку роботи."
                es="9 modulos que automatizan cada paso de tu busqueda de empleo."
                className="text-[#9a9ea6]"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Target className="h-5 w-5" />}
                titleEn="Search Profiles"
                titleUa="Профілі пошуку"
                titleEs="Perfiles de busqueda"
                descEn="Create multiple search profiles with custom job titles, salary ranges, geography, and platform preferences. AI suggests optimal profiles from your resume analysis."
                descUa="Створюйте декілька профілів пошуку з власними посадами, діапазонами зарплат, географією та платформами. ШІ пропонує оптимальні профілі з аналізу вашого резюме."
                descEs="Crea multiples perfiles de busqueda con puestos, rangos salariales, geografia y plataformas personalizados. La IA sugiere perfiles optimos desde tu CV."
              />

              <FeatureCard
                icon={<Search className="h-5 w-5" />}
                titleEn="Multi-Platform Scraping"
                titleUa="Мультиплатформний скрапінг"
                titleEs="Scraping multiplataforma"
                descEn="Daily automated scraping across 11 job boards: LinkedIn, Indeed, Glassdoor, Djinni, DOU, Work.ua, Robota.ua, Jooble, RemoteOK, WeWorkRemotely, and InfoJobs."
                descUa="Щоденний автоматичний скрапінг 11 платформ: LinkedIn, Indeed, Glassdoor, Djinni, DOU, Work.ua, Robota.ua, Jooble, RemoteOK, WeWorkRemotely та InfoJobs."
                descEs="Scraping diario automatizado de 11 portales: LinkedIn, Indeed, Glassdoor, Djinni, DOU, Work.ua, Robota.ua, Jooble, RemoteOK, WeWorkRemotely e InfoJobs."
              />

              <FeatureCard
                icon={<Brain className="h-5 w-5" />}
                titleEn="AI Match Scoring"
                titleUa="ШІ оцінка відповідності"
                titleEs="Puntuacion con IA"
                descEn="Every vacancy gets an AI match score based on your skills, experience, salary expectations, and preferences. Focus on the best opportunities first."
                descUa="Кожна вакансія отримує ШІ-оцінку відповідності на основі ваших навичок, досвіду, зарплатних очікувань та вподобань. Фокус на найкращих можливостях."
                descEs="Cada vacante recibe una puntuacion basada en tus habilidades, experiencia, expectativas salariales y preferencias. Enfocate en las mejores oportunidades."
              />

              <FeatureCard
                icon={<FileText className="h-5 w-5" />}
                titleEn="Resume Parsing"
                titleUa="Парсинг резюме"
                titleEs="Analisis de CV"
                descEn="Upload your PDF resume and let AI extract skills, experience, education, and generate your complete profile. Creates search strategies and interview Q&A pairs automatically."
                descUa="Завантажте PDF резюме і ШІ витягне навички, досвід, освіту та згенерує повний профіль. Автоматично створює стратегії пошуку та пари Q&A для співбесід."
                descEs="Sube tu CV en PDF y la IA extrae habilidades, experiencia, educacion y genera tu perfil completo. Crea estrategias de busqueda y pares Q&A automaticamente."
              />

              <FeatureCard
                icon={<MessageSquare className="h-5 w-5" />}
                titleEn="Q&A Knowledge Base"
                titleUa="База знань Q&A"
                titleEs="Base de conocimientos Q&A"
                descEn="AI answers screening questions from your history and resume data. Build a reusable knowledge base across all applications. Never answer the same question twice."
                descUa="ШІ відповідає на скринінгові питання з вашої історії та резюме. Створюйте базу знань для всіх заявок. Ніколи не відповідайте на одне питання двічі."
                descEs="La IA responde preguntas de screening desde tu historial y CV. Construye una base de conocimientos reutilizable. Nunca respondas la misma pregunta dos veces."
              />

              <FeatureCard
                icon={<Zap className="h-5 w-5" />}
                titleEn="Application Tracking"
                titleUa="Відстеження заявок"
                titleEs="Seguimiento de solicitudes"
                descEn="Track every application through the full pipeline: scraped, scored, reviewed, applied, responded. Semi-auto or full-auto apply modes for high-scoring matches."
                descUa="Відстежуйте кожну заявку через повний пайплайн: знайдено, оцінено, переглянуто, подано, відповідь. Напівавто або повністю автоматична подача для найкращих збігів."
                descEs="Rastrea cada solicitud a traves del pipeline completo: encontrada, puntuada, revisada, aplicada, respondida. Modos semi-auto o auto-aplicar para las mejores coincidencias."
              />

              <FeatureCard
                icon={<Mail className="h-5 w-5" />}
                titleEn="Email Tracking"
                titleUa="Відстеження листів"
                titleEs="Seguimiento de correos"
                descEn="Automatically detect and classify recruiter email responses. Link emails to applications for full visibility across your job search pipeline."
                descUa="Автоматичне розпізнавання та класифікація відповідей рекрутерів. Прив'язка листів до заявок для повної видимості пайплайну пошуку роботи."
                descEs="Deteccion y clasificacion automatica de respuestas de reclutadores por correo. Vincula correos a solicitudes para visibilidad completa del pipeline."
              />

              <FeatureCard
                icon={<PenTool className="h-5 w-5" />}
                titleEn="Cover Letters"
                titleUa="Супровідні листи"
                titleEs="Cartas de presentacion"
                descEn="AI generates personalized cover letters for each vacancy in the vacancy's language. Review and edit, or send as-is for high-confidence matches."
                descUa="ШІ генерує персоналізовані супровідні листи для кожної вакансії мовою вакансії. Перегляньте та відредагуйте, або надішліть як є для найкращих збігів."
                descEs="La IA genera cartas personalizadas por vacante en el idioma de la vacante. Revisa y edita, o envia tal cual para las mejores coincidencias."
              />

              <FeatureCard
                icon={<BarChart3 className="h-5 w-5" />}
                titleEn="Analytics Dashboard"
                titleUa="Аналітичний дашборд"
                titleEs="Panel de analitica"
                descEn="Application funnel visualization, platform comparison, score distribution, response rates, and weekly trends. Full insight into your job search performance."
                descUa="Візуалізація воронки заявок, порівняння платформ, розподіл оцінок, відсоток відповідей та тижневі тренди. Повна аналітика ефективності пошуку роботи."
                descEs="Embudo de solicitudes, comparacion de plataformas, distribucion de puntuaciones, tasas de respuesta y tendencias semanales. Analisis completo del rendimiento."
              />
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 text-center">
              <T
                as="h2"
                en="How it works"
                ua="Як це працює"
                es="Como funciona"
                className="mb-3 text-3xl font-bold sm:text-4xl"
              />
              <T
                as="p"
                en="Four steps from resume to interviews."
                ua="Чотири кроки від резюме до співбесід."
                es="Cuatro pasos del curriculum a las entrevistas."
                className="text-[#9a9ea6]"
              />
            </div>

            <div className="space-y-0">
              {[
                {
                  step: 1,
                  titleEn: "Upload your resume",
                  titleUa: "Завантажте резюме",
                  titleEs: "Sube tu curriculum",
                  descEn: "Drop a PDF or paste a URL. AI analyzes everything and creates your profile, search strategies, and Q&A pairs.",
                  descUa: "Перетягніть PDF або вставте посилання. ШІ проаналізує все і створить профіль, стратегії пошуку та пари Q&A.",
                  descEs: "Arrastra un PDF o pega una URL. La IA lo analiza todo y crea tu perfil, estrategias de busqueda y pares Q&A.",
                },
                {
                  step: 2,
                  titleEn: "Configure searches",
                  titleUa: "Налаштуйте пошуки",
                  titleEs: "Configura busquedas",
                  descEn: "Set job titles, salary range, geography, platforms. AI suggests optimal search profiles from your resume.",
                  descUa: "Вкажіть посади, діапазон зарплат, географію, платформи. ШІ запропонує оптимальні профілі пошуку з резюме.",
                  descEs: "Define puestos, rango salarial, geografia, plataformas. La IA sugiere perfiles de busqueda optimos desde tu CV.",
                },
                {
                  step: 3,
                  titleEn: "Review & apply",
                  titleUa: "Перегляньте і подавайте",
                  titleEs: "Revisa y aplica",
                  descEn: "Scored vacancies appear in your queue. AI generates cover letters. Approve individually or enable auto-apply.",
                  descUa: "Оцінені вакансії з'являються в черзі. ШІ генерує супровідні листи. Схвалюйте по одній або увімкніть авто-подачу.",
                  descEs: "Las vacantes puntuadas aparecen en tu cola. La IA genera cartas. Aprueba individualmente o activa auto-aplicar.",
                },
                {
                  step: 4,
                  titleEn: "Track responses",
                  titleUa: "Відстежуйте відповіді",
                  titleEs: "Rastrea respuestas",
                  descEn: "Monitor email responses, interviews, and offers. Full analytics dashboard shows your pipeline health.",
                  descUa: "Моніторте відповіді на листи, співбесіди та офери. Аналітичний дашборд показує здоров'я вашого пайплайну.",
                  descEs: "Monitorea respuestas por correo, entrevistas y ofertas. El panel de analitica muestra la salud de tu pipeline.",
                },
              ].map(({ step, titleEn, titleUa, titleEs, descEn, descUa, descEs }) => (
                <div key={step} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold shadow-lg shadow-blue-600/20">
                      {step}
                    </div>
                    {step < 4 && (
                      <div className="my-1 h-16 w-px bg-gradient-to-b from-blue-500/30 to-transparent" />
                    )}
                  </div>
                  <div className="pb-8">
                    <T
                      as="h3"
                      en={titleEn}
                      ua={titleUa}
                      es={titleEs}
                      className="mb-1 font-semibold text-white/90"
                    />
                    <T
                      as="p"
                      en={descEn}
                      ua={descUa}
                      es={descEs}
                      className="text-sm text-[#9a9ea6]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== PLATFORMS ==================== */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <T
                as="h2"
                en="11 platforms supported"
                ua="11 платформ підтримується"
                es="11 plataformas soportadas"
                className="mb-3 text-3xl font-bold sm:text-4xl"
              />
              <T
                as="p"
                en="Scrape vacancies from all major job boards."
                ua="Скрапінг вакансій з усіх основних джерел."
                es="Scraping de vacantes de todos los principales portales."
                className="text-[#9a9ea6]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                "LinkedIn", "Indeed", "Glassdoor", "Djinni", "DOU",
                "Work.ua", "Robota.ua", "Jooble", "RemoteOK", "WeWorkRemotely", "InfoJobs",
              ].map((p) => (
                <PlatformBadge key={p} name={p} />
              ))}
            </div>
          </div>
        </section>

        {/* ==================== TECH STACK ==================== */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <T
                as="h2"
                en="Built with modern stack"
                ua="Побудовано на сучасному стеку"
                es="Construido con stack moderno"
                className="mb-3 text-3xl font-bold sm:text-4xl"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Next.js 16" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="React 19" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="TypeScript 5" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Prisma 7" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="PostgreSQL" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Tailwind CSS 4" />
              <TechBadge icon={<Lock className="h-3.5 w-3.5 text-blue-400/60" />} name="NextAuth 5" />
              <TechBadge icon={<Brain className="h-3.5 w-3.5 text-blue-400/60" />} name="Ollama / Gemini / Groq" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Playwright" />
              <TechBadge icon={<Server className="h-3.5 w-3.5 text-blue-400/60" />} name="Docker" />
              <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Serwist (PWA)" />
              <TechBadge icon={<Globe className="h-3.5 w-3.5 text-blue-400/60" />} name="next-intl" />
              <TechBadge icon={<BarChart3 className="h-3.5 w-3.5 text-blue-400/60" />} name="Recharts" />
              <TechBadge icon={<FileText className="h-3.5 w-3.5 text-blue-400/60" />} name="pdf-parse" />
            </div>
          </div>
        </section>

        {/* ==================== SELF-HOSTED ==================== */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 sm:p-12">
              <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-600/20">
                  <Server className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                    <T
                      as="h3"
                      en="Self-hosted & private"
                      ua="Власний сервер і приватність"
                      es="Self-hosted y privado"
                      className="text-xl font-bold"
                    />
                    <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                      <T en="Your server" ua="Ваш сервер" es="Tu servidor" />
                    </span>
                  </div>
                  <T
                    as="p"
                    en="Run JobFinder on your own server. Your resumes, applications, and credentials never leave your infrastructure. Full control over AI providers."
                    ua="Запустіть JobFinder на власному сервері. Ваші резюме, заявки та облікові дані ніколи не покидають вашу інфраструктуру. Повний контроль над ШІ провайдерами."
                    es="Ejecuta JobFinder en tu propio servidor. Tus CVs, solicitudes y credenciales nunca salen de tu infraestructura. Control total sobre proveedores de IA."
                    className="text-[#9a9ea6]"
                  />
                </div>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <T
                      as="p"
                      en="Your data stays yours"
                      ua="Ваші дані залишаються вашими"
                      es="Tus datos son tuyos"
                      className="text-sm font-medium text-white/80"
                    />
                    <T
                      as="p"
                      en="Resumes, applications, credentials — everything on your server"
                      ua="Резюме, заявки, облікові дані — все на вашому сервері"
                      es="CVs, solicitudes, credenciales — todo en tu servidor"
                      className="text-xs text-[#9a9ea6]"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <T
                      as="p"
                      en="Full control"
                      ua="Повний контроль"
                      es="Control total"
                      className="text-sm font-medium text-white/80"
                    />
                    <T
                      as="p"
                      en="Choose AI provider: local Ollama, Gemini, or Groq"
                      ua="Обирайте ШІ провайдера: локальний Ollama, Gemini або Groq"
                      es="Elige proveedor de IA: Ollama local, Gemini o Groq"
                      className="text-xs text-[#9a9ea6]"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Code className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <T
                      as="p"
                      en="Free forever"
                      ua="Безкоштовно назавжди"
                      es="Gratis para siempre"
                      className="text-sm font-medium text-white/80"
                    />
                    <T
                      as="p"
                      en="Open source, no subscription fees, no limits"
                      ua="Відкритий код, без підписок, без обмежень"
                      es="Codigo abierto, sin suscripciones, sin limites"
                      className="text-xs text-[#9a9ea6]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== CTA ==================== */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <T
              as="h2"
              en="Ready to automate your job search?"
              ua="Готові автоматизувати пошук роботи?"
              es="Listo para automatizar tu busqueda?"
              className="mb-6 text-3xl font-bold sm:text-4xl"
            />
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:brightness-110"
            >
              <T en="Get Started" ua="Почати" es="Empezar" />
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-white/[0.06] py-12">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <T
              as="p"
              en="JobFinder — Open source, self-hosted job search automation. AGPL-3.0 License."
              ua="JobFinder — відкрите, self-hosted рішення для автоматизації пошуку роботи. Ліцензія AGPL-3.0."
              es="JobFinder — Automatizacion de busqueda de empleo open source y self-hosted. Licencia AGPL-3.0."
              className="text-sm text-white/30"
            />
          </div>
        </footer>
      </div>
    </>
  );
}
