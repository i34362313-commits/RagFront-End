import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Brain,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  FileText,
  Clock,
  Cpu,
  Zap,
  BookOpen,
  Calculator,
  GitCompareArrows,
  Loader2,
  Download,
} from 'lucide-react';
import type { Summary } from '@/types/database';

export default function SummaryView() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const { projectId, summaryId } = useParams();
  const navigate = useNavigate();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['summary', summaryId],
    queryFn: async (): Promise<Summary> => {
      const { data, error } = await supabase
        .from('summaries')
        .select('*')
        .eq('id', summaryId!)
        .single();
      if (error) throw error;
      return data as Summary;
    },
    enabled: !!summaryId,
  });

  const { data: project } = useQuery({
    queryKey: ['project-name', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!summary) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Sumário não encontrado</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const content = parseContent(summary.content);
  const sections = content ? extractSections(content) : null;

  const parseError = !content;

  const handleExportPdf = async () => {
    if (!summary) return;
    setIsExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;

      // Get the content container (skip nav/header buttons)
      const contentEl = document.getElementById('summary-pdf-content');
      if (!contentEl) throw new Error('Content not found');

      // Capture the rendered content as canvas
      const canvas = await html2canvas(contentEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;

      // Add logo at top of first page
      let logoY = 8;
      try {
        const logoResponse = await fetch('/images/rz3-logo.png');
        const logoBlob = await logoResponse.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoDataUrl;
        });
        const ratio = img.width / img.height;
        const logoH = 12;
        const logoW = logoH * ratio;
        doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoW) / 2, logoY, logoW, logoH);
        logoY += logoH + 4;
      } catch (logoErr) {
        console.error('Logo load error:', logoErr);
      }

      // Calculate how the captured content fits across pages
      const contentRatio = canvas.height / canvas.width;
      const scaledHeight = usableWidth * contentRatio;
      const startY = logoY + 2;
      const availableFirstPage = pageHeight - startY - margin;
      const availableNextPages = pageHeight - margin * 2;

      if (scaledHeight <= availableFirstPage) {
        // Fits on one page
        doc.addImage(imgData, 'JPEG', margin, startY, usableWidth, scaledHeight);
      } else {
        // Multi-page: slice the canvas into page-sized chunks
        let remainingHeight = canvas.height;
        let sourceY = 0;
        let isFirst = true;

        while (remainingHeight > 0) {
          const availableH = isFirst ? availableFirstPage : availableNextPages;
          const pageStartY = isFirst ? startY : margin;
          // How much of the source canvas fits on this page
          const sourceChunkHeight = Math.min(
            remainingHeight,
            (availableH / scaledHeight) * canvas.height
          );

          // Create a temporary canvas for this slice
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sourceChunkHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0, sourceY, canvas.width, sourceChunkHeight,
              0, 0, canvas.width, sourceChunkHeight
            );
          }

          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          const sliceRenderedH = (sourceChunkHeight / canvas.width) * usableWidth;

          if (!isFirst) doc.addPage();
          doc.addImage(sliceData, 'JPEG', margin, pageStartY, usableWidth, sliceRenderedH);

          sourceY += sourceChunkHeight;
          remainingHeight -= sourceChunkHeight;
          isFirst = false;
        }
      }

      const fileName = `sumario_v${summary.version}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(fileName);

      toast({ title: 'PDF exportado', description: `Arquivo ${fileName} baixado com sucesso.` });
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl py-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para {project?.name || 'projeto'}
          </Button>

          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Sumário — Versão {summary.version}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Gerado em{' '}
                    {format(new Date(summary.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleExportPdf}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="shrink-0"
              data-html2canvas-ignore="true"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Exportar PDF
            </Button>
          </div>
        </div>

        <div id="summary-pdf-content" className="space-y-8" style={{ background: '#ffffff', padding: '0' }}>

        {parseError && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive font-medium">Erro ao formatar resposta</p>
              <p className="text-sm text-muted-foreground mt-1">Não foi possível interpretar o conteúdo do sumário.</p>
            </CardContent>
          </Card>
        )}

        {sections && (
          <>
            {/* Visão Geral */}
            {sections.overview && (
              <SectionCard
                icon={<Brain className="h-5 w-5 text-primary" />}
                title="Visão Geral"
                color="primary"
              >
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  <RichContent value={sections.overview} />
                </div>
              </SectionCard>
            )}

            {/* Insights */}
            {sections.insights.length > 0 && (
              <SectionCard
                icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
                title="Principais Insights"
                color="amber"
              >
                <div className="space-y-4">
                  {sections.insights.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="text-sm text-foreground leading-relaxed">
                        <RichContent value={item} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Inconsistencies */}
            {sections.inconsistencies.length > 0 && (
              <SectionCard
                icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                title="Inconsistências"
                color="red"
              >
                <div className="space-y-4">
                  {sections.inconsistencies.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        !
                      </span>
                      <div className="text-sm text-foreground leading-relaxed">
                        <RichContent value={item} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Opportunities */}
            {sections.opportunities.length > 0 && (
              <SectionCard
                icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
                title="Oportunidades"
                color="emerald"
              >
                <div className="space-y-4">
                  {sections.opportunities.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        ✓
                      </span>
                      <div className="text-sm text-foreground leading-relaxed">
                        <RichContent value={item} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Analyses */}
            {sections.analyses.length > 0 && (
              <SectionCard
                icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                title="Análises"
                color="blue"
              >
                <div className="space-y-4">
                  {sections.analyses.map((item, i) => (
                    <div key={i} className="text-sm text-foreground leading-relaxed">
                      <RichContent value={item} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Calculations — only show items with real analytical content (formula or substantive description) */}
            {(() => {
              const meaningful = Object.entries(sections.calculations).filter(([, value]) => {
                if (!value || typeof value !== 'object') return false;
                const v = value as Record<string, unknown>;
                const formula = typeof v.formula === 'string' ? v.formula.trim() : '';
                const description = typeof v.description === 'string' ? v.description.trim() : '';
                return formula.length > 0 || description.length > 30;
              });
              if (meaningful.length === 0) return null;
              return (
                <SectionCard
                  icon={<Calculator className="h-5 w-5 text-violet-500" />}
                  title="Cálculos e Estimativas"
                  color="violet"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {meaningful.map(([key, value]) => {
                      const v = value as Record<string, unknown>;
                      const label = typeof v.label === 'string' ? v.label : formatKey(key);
                      return (
                        <div key={key} className="rounded-lg border bg-muted/30 p-4 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </p>
                          {v.value !== undefined && v.value !== '' && (
                            <div className="text-base font-semibold text-foreground">
                              <RichContent value={v.value} />
                            </div>
                          )}
                          {typeof v.formula === 'string' && v.formula.trim() && (
                            <div className="text-xs font-mono bg-background/60 border rounded px-2 py-1 text-muted-foreground break-words">
                              {v.formula}
                            </div>
                          )}
                          {typeof v.description === 'string' && v.description.trim() && (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {v.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              );
            })()}

            {/* Data Crossings */}
            {sections.dataCrossings && Object.keys(sections.dataCrossings).length > 0 && (
              <SectionCard
                icon={<GitCompareArrows className="h-5 w-5 text-orange-500" />}
                title="Cruzamento de Dados"
                color="orange"
              >
                <div className="space-y-3">
                  <RichContent value={sections.dataCrossings} />
                </div>
              </SectionCard>
            )}

            {/* Justifications */}
            {sections.justifications.length > 0 && (
              <SectionCard
                icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                title="Justificativas"
                color="slate"
              >
                <ul className="space-y-3">
                  {sections.justifications.map((item, i) => (
                    <li key={i} className="text-sm text-foreground leading-relaxed pl-4 border-l-2 border-border">
                      {typeof item === 'string' ? item : <RichContent value={item} />}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* References */}
            {sections.references.length > 0 && (
              <SectionCard
                icon={<BookOpen className="h-5 w-5 text-cyan-500" />}
                title="Referências"
                color="cyan"
              >
                <div className="space-y-2">
                  {sections.references.map((ref, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      {typeof ref === 'string' ? (
                        <p className="text-foreground">{ref}</p>
                      ) : (
                        <RichContent value={ref} />
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Remaining unknown sections */}
            {sections.remaining && Object.keys(sections.remaining).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outros Dados</CardTitle>
                </CardHeader>
                <CardContent>
                  <RichContent value={sections.remaining} />
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.model_used && (
            <Badge variant="secondary" className="gap-1.5">
              <Cpu className="h-3 w-3" />
              {summary.model_used}
            </Badge>
          )}
          {summary.tokens_used && (
            <Badge variant="secondary" className="gap-1.5">
              <Zap className="h-3 w-3" />
              {summary.tokens_used.toLocaleString()} tokens
            </Badge>
          )}
          {summary.generation_time_ms && (
            <Badge variant="secondary" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {(summary.generation_time_ms / 1000).toFixed(1)}s
            </Badge>
          )}
        </div>

        {summary.prompt_used && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              Ver prompt utilizado
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {summary.prompt_used}
                </pre>
              </CardContent>
            </Card>
          </details>
        )}
      </div>
    </AppLayout>
  );
}

// --- Rich Content Renderer ---
// Renders any value (string, number, array, object) as clean formatted text
// without brackets, braces, or JSON syntax.

function RichContent({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;

  // Strings → render as markdown (backend often returns markdown text with headings, tables, lists, bold)
  if (typeof value === 'string') {
    const cleaned = sanitizeMarkdown(value);
    if (!cleaned.trim()) return null;
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-table:text-sm prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-th:border prose-td:border prose-table:border-collapse">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
      </div>
    );
  }

  // Numbers / booleans
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>;
  }

  // Arrays
  if (Array.isArray(value)) {
    // Array of primitives → bullet list
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <ul className="space-y-1.5 ml-1">
          {value.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground mt-1">•</span>
              <span>{String(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    // Array of objects
    return (
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="rounded-lg border bg-muted/20 p-3">
            <RichContent value={item} />
          </div>
        ))}
      </div>
    );
  }

  // Objects
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);

    // Detect "count map" patterns and render as a compact grid:
    //  - { "1038": 1, "1040": 3, ... } (number values)
    //  - { "Reg C100": { evidence_count: 13 }, ... } (single numeric leaf)
    const countEntries = extractCountEntries(entries);
    if (countEntries && countEntries.length >= 4) {
      return <CountGrid entries={countEntries} />;
    }

    return (
      <div className="space-y-3">
        {entries.map(([key, val]) => (
          <div key={key}>
            <p className="font-semibold text-foreground text-sm mb-1">
              {formatKey(key)}
            </p>
            <div className="text-sm text-muted-foreground pl-3 border-l-2 border-border">
              <RichContent value={val} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

// Extracts [label, count] pairs when every value is a number, or every value
// is an object with a single numeric leaf (e.g. { evidence_count: 13 }).
function extractCountEntries(entries: [string, unknown][]): [string, number][] | null {
  if (entries.length === 0) return null;
  const result: [string, number][] = [];
  for (const [k, v] of entries) {
    if (typeof v === 'number') {
      result.push([k, v]);
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v as Record<string, unknown>);
      if (inner.length === 1 && typeof inner[0][1] === 'number') {
        result.push([k, inner[0][1] as number]);
        continue;
      }
    }
    return null;
  }
  return result;
}

function CountGrid({ entries }: { entries: [string, number][] }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const max = sorted[0]?.[1] ?? 0;
  const LIMIT = 24;
  const visible = showAll ? sorted : sorted.slice(0, LIMIT);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{sorted.length} itens</span>
        <span>
          Total: <span className="font-semibold text-foreground tabular-nums">{total.toLocaleString()}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {visible.map(([label, count]) => {
          const pct = max ? (count / max) * 100 : 0;
          return (
            <div
              key={label}
              className="relative overflow-hidden rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs flex items-center justify-between gap-2"
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative truncate font-mono text-foreground" title={label}>
                {formatKey(label)}
              </span>
              <span className="relative font-semibold text-foreground tabular-nums">
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      {sorted.length > LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {showAll ? 'Mostrar menos' : `Mostrar todos (${sorted.length})`}
        </button>
      )}
    </div>
  );
}

// --- Helper: format snake_case / camelCase keys into readable labels ---
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Helper: strip "Dado não disponível" noise from markdown ---
// - Removes table rows whose data cells are ALL unavailable/placeholder values
// - Removes the whole table if it ends up with no data rows
// - Removes bullet lines that are just "<label>: dado não disponível"
const UNAVAILABLE_RE =
  /^(?:-+|n\/?a|nada|nenhum[ao]?|sem dados?|dado(?:s)?\s+(?:n[aã]o\s+dispon[ií]ve(?:l|is)|indispon[ií]ve(?:l|is))(?:\s+nos?\s+arquivos?\s+analisados?)?|n[aã]o\s+(?:informado|dispon[ií]ve(?:l|is))|indispon[ií]ve(?:l|is))\.?$/i;

function isUnavailableCell(cell: string): boolean {
  const stripped = cell.replace(/[*_`]/g, '').trim();
  if (!stripped) return true;
  return UNAVAILABLE_RE.test(stripped);
}

function sanitizeMarkdown(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    const nextIsSeparator =
      i + 1 < lines.length && /^\s*\|?\s*:?-{2,}.*\|/.test(lines[i + 1]);

    if (isTableRow && nextIsSeparator) {
      // Collect full table
      const header = line;
      const separator = lines[i + 1];
      const rows: string[] = [];
      let j = i + 2;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        rows.push(lines[j]);
        j++;
      }

      const kept = rows.filter((row) => {
        const cells = row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        // Drop row only if every cell besides the first (label) is unavailable
        const dataCells = cells.slice(1);
        if (dataCells.length === 0) return true;
        return !dataCells.every(isUnavailableCell);
      });

      if (kept.length > 0) {
        out.push(header, separator, ...kept);
      }
      i = j;
      continue;
    }

    // Bullet/line like "- Campo: Dado não disponível"
    const bulletMatch = line.match(/^(\s*[-*+]\s+)(.*)$/);
    if (bulletMatch) {
      const body = bulletMatch[2];
      const afterColon = body.includes(':') ? body.split(':').slice(1).join(':').trim() : body.trim();
      if (afterColon && isUnavailableCell(afterColon)) {
        i++;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
}


// --- Helper Components ---

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// --- Data extraction helpers ---

function toArray(val: unknown): unknown[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [val];
}

/**
 * Cleans a potentially markdown-wrapped JSON string and parses it.
 */
function parseContent(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;

  // Already an object
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    // Check if the object has a single string value that is JSON
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && typeof obj[keys[0]] === 'string') {
      const parsed = tryParseJsonString(obj[keys[0]] as string);
      if (parsed) return parsed;
    }
    // Check every string value for embedded JSON
    const result: Record<string, unknown> = {};
    let hadParsed = false;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        const parsed = tryParseJsonString(v);
        if (parsed) {
          Object.assign(result, parsed);
          hadParsed = true;
        } else {
          result[k] = v;
        }
      } else {
        result[k] = v;
      }
    }
    return hadParsed ? result : obj;
  }

  if (typeof raw === 'string') {
    const parsed = tryParseJsonString(raw);
    return parsed;
  }

  return null;
}

function tryParseJsonString(str: string): Record<string, unknown> | null {
  try {
    // Remove markdown code fences
    let cleaned = str.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '');
    // Remove wrapping quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    // Unescape if needed
    cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    cleaned = cleaned.trim();
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) return null;
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

const KNOWN_KEYS = [
  'visao_geral', 'visão_geral', 'overview', 'resumo',
  'insights', 'principais_insights',
  'inconsistencias', 'inconsistências', 'alertas',
  'oportunidades', 'opportunities',
  'analises', 'análises', 'analyses',
  'referencias', 'referências', 'references', 'fontes',
  'calculos', 'cálculos', 'calculations', 'calculos_e_estimativas',
  'cruzamento_de_dados', 'data_crossings', 'cruzamentos', 'cruzamentos_relevantes',
  'justificativas', 'justifications',
];

// Internal orchestration / planner metadata that must NOT be rendered to users.
// Backend should ideally strip these before persisting; we filter defensively here.
const INTERNAL_KEYS = new Set([
  'hypotheses', 'hipoteses', 'hipóteses',
  'needs_driva', 'needsdriva',
  'initial_queries', 'initialqueries', 'queries_iniciais',
  'graph', 'grafo',
  'blocks', 'blocos',
  'plan', 'plano', 'planner', 'planner_output',
  'critic', 'critica', 'crítica', 'critic_output',
  'investigator', 'investigator_output',
  'synthesizer', 'synthesizer_output',
  'trace', 'debug', 'metadata', 'meta',
  'raw', 'raw_output', 'raw_response',
  'topic', 'note', 'from', 'to',
  'model', 'model_used', 'tokens', 'usage',
]);

function extractSections(content: Record<string, unknown>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (content[k] !== undefined && content[k] !== null) return content[k];
    }
    return undefined;
  };

  const overview = get('visao_geral', 'visão_geral', 'overview', 'resumo') as string | undefined;
  const insights = toArray(get('insights', 'principais_insights', 'Insights'));
  const inconsistencies = toArray(get('inconsistencias', 'inconsistências', 'Inconsistencias', 'alertas'));
  const opportunities = toArray(get('oportunidades', 'Oportunidades', 'opportunities'));
  const analyses = toArray(get('analises', 'análises', 'Analises', 'analyses'));
  const references = toArray(get('referencias', 'referências', 'references', 'fontes'));
  const calculations = (get('calculos', 'cálculos', 'calculations', 'calculos_e_estimativas') || {}) as Record<string, unknown>;
  const dataCrossings = (get('cruzamento_de_dados', 'data_crossings', 'cruzamentos', 'cruzamentos_relevantes') || {}) as Record<string, unknown>;
  const justifications = toArray(get('justificativas', 'justifications'));

  // Collect remaining keys not in known sections and not internal orchestration data
  const remaining: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    const lower = k.toLowerCase();
    if (KNOWN_KEYS.includes(lower)) continue;
    if (INTERNAL_KEYS.has(lower)) continue;
    if (v === null || v === undefined) continue;
    remaining[k] = v;
  }

  const isEmpty =
    !overview &&
    insights.length === 0 &&
    inconsistencies.length === 0 &&
    opportunities.length === 0 &&
    analyses.length === 0 &&
    references.length === 0 &&
    Object.keys(calculations).length === 0 &&
    Object.keys(dataCrossings).length === 0 &&
    justifications.length === 0 &&
    Object.keys(remaining).length === 0;

  return { overview, insights, inconsistencies, opportunities, analyses, references, calculations, dataCrossings, justifications, remaining, isEmpty };
}
