import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import HTMLFlipBook from "react-pageflip";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  X,
  BookOpen,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Menu,
} from "lucide-react";
import pdfUrl from "../imports/digital_flipbook-02-AIS-_linked__compressed.pdf?url";
import flipSoundUrl from "../imports/page-flip.mp3?url";

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PROJECTS = [
  {
    id: 1,
    name: "Antraya",
    url: "https://www.aisglass.com/project/exterior-projects/antraya/",
    category: "Exterior",
    type: "Residential",
    page: 6,
    description: "Premium glass facade solutions for the Antraya residential project.",
  },
  {
    id: 2,
    name: "Reliance Corporate Park",
    url: "https://www.aisglass.com/project/exterior-projects/reliance-corporate-park/",
    category: "Exterior",
    type: "Commercial",
    page: 6,
    description: "High-performance glazing for Reliance's iconic corporate headquarters.",
  },
  {
    id: 3,
    name: "Digha Sankarpur Development Authority",
    url: "https://www.aisglass.com/project/exterior-projects/digha-sankarpur-development-authority/",
    category: "Exterior",
    type: "Institutional",
    page: 7,
    description: "Architectural glass for the coastal development authority complex.",
  },
  {
    id: 4,
    name: "Cyber Park",
    url: "https://www.aisglass.com/project/exterior-projects/cyber-park/",
    category: "Exterior",
    type: "Commercial",
    page: 7,
    description: "Modern glazing systems for the technology park campus.",
  },
];

const TYPES = ["All", "Residential", "Commercial", "Institutional"];
const ASPECT = 595.5 / 842.25; // page width / height

export default function App() {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1); // 1-indexed
  const [scale, setScale] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [showSidebar, setShowSidebar] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [showThumbs, setShowThumbs] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [viewMode, setViewMode] = useState<"spread" | "single">("spread");

  const mainRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const [pageHeight, setPageHeight] = useState<number>(580);
  const lastPageRef = useRef<number>(1);

  // --- Flip sound (real audio sample) ---
  const flipAudioRef = useRef<HTMLAudioElement | null>(null);

  const playFlipSound = useCallback(() => {
    try {
      if (!flipAudioRef.current) {
        flipAudioRef.current = new Audio(flipSoundUrl);
      }
      const audio = flipAudioRef.current;
      audio.currentTime = 0;
      audio.volume = 0.6;
      audio.play().catch(() => {
        // Autoplay may be blocked until the user interacts — safe to ignore
      });
    } catch {
      // Audio unsupported — fail silently
    }
  }, []);

  // Track viewport size for responsive layout
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fit a single leaf's size to both available height AND width
  useEffect(() => {
    const update = () => {
      if (!mainRef.current) return;
      const availH = mainRef.current.clientHeight - (showThumbs ? 140 : 60);
      const availW = mainRef.current.clientWidth - (isMobile ? 16 : 32);
      const pagesInRow = isMobile ? 1 : viewMode === "spread" ? 2 : 1;

      let h = Math.max(180, Math.min(availH, 700));
      let w = h * ASPECT;

      if (w * pagesInRow > availW) {
        w = availW / pagesInRow;
        h = w / ASPECT;
      }
      setPageHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    if (mainRef.current) ro.observe(mainRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [showThumbs, viewMode, isMobile]);

  const pageW = Math.round(pageHeight * ASPECT * scale);
  const pageH = Math.round(pageHeight * scale);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < numPages;

  // With showCover enabled, the front/back cover renders as a single page
  // instead of a spread — nudge the book so that single page sits centered
  // rather than flush to one side of the spread's width.
  const isSpreadMode = !isMobile && viewMode === "spread";
  const isFrontCover = isSpreadMode && currentPage === 1;
  const isBackCover = isSpreadMode && numPages > 0 && currentPage === numPages;
  const bookOffset = isFrontCover ? -pageW / 2 : isBackCover ? pageW / 2 : 0;

  const goNext = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext();
  }, []);
  const goPrev = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  const filteredProjects = PROJECTS.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    const matchesType = selectedType === "All" || p.type === selectedType;
    return matchesSearch && matchesType;
  });

  const jumpToPage = (page: number) => {
    // react-pageflip's flip() takes a 0-indexed page number
    bookRef.current?.pageFlip()?.flip(Math.max(0, page - 1));
    if (isMobile) setShowSidebar(false);
  };

  // react-pageflip reports the 0-indexed page it landed on
  const handleFlip = (e: { data: number }) => {
    const newPage = e.data + 1;
    if (newPage !== lastPageRef.current) {
      playFlipSound();
    }
    lastPageRef.current = newPage;
    setCurrentPage(newPage);
  };

  return (
    <div
      className="flex flex-col h-screen bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 border-b border-border bg-card shrink-0 z-10">
        <button
          onClick={() => setShowSidebar((v) => !v)}
          className="md:hidden p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          aria-label="Toggle project list"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <BookOpen className="w-5 h-5 text-primary" />
          <span
            className="font-semibold text-sm hidden sm:inline"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            AIS Glass
          </span>
          <span className="text-muted-foreground text-xs hidden lg:inline">
            · Exterior Projects Flipbook
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs ml-1 sm:ml-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-md bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="Search projects…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="hidden md:flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                selectedType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {/* View mode */}
          <button
            onClick={() => setViewMode((v) => (v === "spread" ? "single" : "spread"))}
            className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 px-2 ${
              viewMode === "spread"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:block text-xs">{viewMode === "spread" ? "Spread" : "Single"}</span>
          </button>

          <div className="w-px h-4 bg-border hidden sm:block" />

          {/* Zoom */}
          <button
            onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.15).toFixed(2))))}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:block"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground w-9 text-center tabular-nums hidden sm:inline">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, parseFloat((s + 0.15).toFixed(2))))}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:block"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-border hidden md:block" />

          <button
            onClick={() => setShowSidebar((v) => !v)}
            className={`p-1.5 rounded transition-colors hidden md:block ${
              showSidebar
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main area */}
        <div ref={mainRef} className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Flipbook stage */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative px-10 sm:px-14">
            {/* Prev arrow */}
            <button
              onClick={goPrev}
              disabled={!canGoPrev}
              className="absolute left-1 sm:left-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-card border border-border text-foreground disabled:opacity-20 hover:enabled:bg-secondary hover:enabled:border-primary/50 transition-all shadow-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              style={{
                transform: `translateX(${bookOffset}px)`,
                transition: "transform 300ms ease",
              }}
            >
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading flipbook…
                </div>
              }
            >
              {numPages > 0 && (
                <HTMLFlipBook
                  key={`${pageW}x${pageH}-${viewMode}-${isMobile}`} // re-init when size/mode changes
                  ref={bookRef}
                  width={pageW}
                  height={pageH}
                  size="fixed"
                  minWidth={200}
                  maxWidth={1200}
                  minHeight={300}
                  maxHeight={1600}
                  showCover={true}
                  usePortrait={isMobile || viewMode === "single"}
                  mobileScrollSupport={true}
                  drawShadow={true}
                  maxShadowOpacity={0.5}
                  flippingTime={700}
                  useMouseEvents={true}
                  swipeDistance={20}
                  clickEventForward={true}
                  startPage={Math.max(0, currentPage - 1)}
                  onFlip={handleFlip}
                  className="shadow-2xl"
                  style={{}}
                >
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
                    <div key={pg} className="bg-white relative overflow-hidden">
                      <Page
                        pageNumber={pg}
                        height={pageH}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        loading={<PageSkeleton height={pageH} width={pageW} />}
                      />
                      <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 select-none pointer-events-none">
                        {pg}
                      </span>
                    </div>
                  ))}
                </HTMLFlipBook>
              )}
            </Document>
            </div>

            {/* Next arrow */}
            <button
              onClick={goNext}
              disabled={!canGoNext}
              className="absolute right-1 sm:right-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-card border border-border text-foreground disabled:opacity-20 hover:enabled:bg-secondary hover:enabled:border-primary/50 transition-all shadow-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnail strip */}
          {showThumbs && numPages > 0 && (
            <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur px-2 sm:px-4 py-2">
              <Document file={pdfUrl} loading={null}>
                <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => {
                    const isActive = pg === currentPage;
                    return (
                      <button
                        key={pg}
                        onClick={() => jumpToPage(pg)}
                        className={`shrink-0 rounded overflow-hidden border-2 transition-all ${
                          isActive
                            ? "border-primary shadow-md"
                            : "border-transparent opacity-60 hover:opacity-100 hover:border-muted-foreground/30"
                        }`}
                      >
                        <Page
                          pageNumber={pg}
                          height={64}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          loading={
                            <div style={{ width: 45, height: 64 }} className="bg-muted animate-pulse" />
                          }
                        />
                        <div
                          className={`text-center text-[9px] py-0.5 ${
                            isActive ? "text-primary font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {pg}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Document>
            </div>
          )}

          {/* Status bar */}
          <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-1.5 border-t border-border bg-card/50 text-[11px] text-muted-foreground">
            <button
              onClick={() => setShowThumbs((v) => !v)}
              className="hover:text-foreground transition-colors"
            >
              {showThumbs ? "Hide thumbnails" : "Show thumbnails"}
            </button>
            <span className="tabular-nums">
              {numPages > 0 ? `Page ${currentPage} of ${numPages}` : "Loading…"}
            </span>
            <span className="hidden sm:inline">← → to navigate, or drag a page corner</span>
          </div>
        </div>

        {/* Sidebar backdrop (mobile only) */}
        {showSidebar && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Sidebar */}
        {showSidebar && (
          <aside
            className={
              isMobile
                ? "fixed top-0 right-0 bottom-0 z-50 w-[85vw] max-w-[320px] shadow-2xl border-l border-border bg-card flex flex-col overflow-hidden"
                : "w-68 border-l border-border bg-card shrink-0 flex flex-col overflow-hidden"
            }
            style={!isMobile ? { width: 272 } : undefined}
          >
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
                  Project Index
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredProjects.length === PROJECTS.length
                    ? `${PROJECTS.length} projects`
                    : `${filteredProjects.length} of ${PROJECTS.length} projects`}
                </p>
              </div>
              {isMobile && (
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Close project list"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="md:hidden flex flex-wrap gap-1 px-4 py-2 border-b border-border">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    selectedType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
              {filteredProjects.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No projects match your filters.</p>
                  <button
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() => { setSearchQuery(""); setSelectedType("All"); }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                filteredProjects.map((proj) => (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    isActive={proj.page === currentPage}
                    onJump={() => jumpToPage(proj.page)}
                    searchQuery={searchQuery}
                  />
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Click{" "}
                <ExternalLink className="inline w-2.5 h-2.5" /> to open the full project on AIS Glass website.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function PageSkeleton({ height, width }: { height: number; width: number }) {
  return (
    <div
      style={{ height, width }}
      className="bg-gray-50 animate-pulse flex items-center justify-center"
    >
      <BookOpen className="w-8 h-8 text-gray-200" />
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-foreground rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function ProjectCard({
  project,
  isActive,
  onJump,
  searchQuery,
}: {
  project: (typeof PROJECTS)[0];
  isActive: boolean;
  onJump: () => void;
  searchQuery: string;
}) {
  const typeColors: Record<string, string> = {
    Commercial: "bg-sky-500/15 text-sky-400",
    Residential: "bg-emerald-500/15 text-emerald-400",
    Institutional: "bg-violet-500/15 text-violet-400",
  };

  return (
    <div
      className={`mx-3 my-2 rounded-lg border transition-all duration-200 ${
        isActive
          ? "border-primary/60 bg-primary/5 shadow shadow-primary/10"
          : "border-border hover:border-border/60 hover:bg-secondary/30"
      }`}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-tight">
            {highlightText(project.name, searchQuery)}
          </h3>
          <span
            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[project.type] ?? "bg-muted text-muted-foreground"}`}
          >
            {project.type}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {project.description}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onJump}
            className={`flex-1 text-[11px] py-1.5 rounded-md transition-colors text-center font-medium ${
              isActive
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "bg-secondary hover:bg-secondary/70 text-secondary-foreground"
            }`}
          >
            {isActive ? "Currently viewing" : `Go to page ${project.page}`}
          </button>
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md border border-border hover:border-primary/50 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
            title="Open on AIS Glass website"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}