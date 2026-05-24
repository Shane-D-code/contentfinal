import axios from 'axios'

export const api = axios.create({ baseURL: '', timeout: 300_000 })

export interface QualityScores { quality_score:number; aesthetic_score:number; blur_score:number; brightness_score:number; calibrated?:boolean }
export interface BBox { x1:number; y1:number; x2:number; y2:number }
export interface HighlightClip { start:number; end:number; score:number }

export interface QualityResult   { filename:string; file_url:string; scores:QualityScores }
export interface FaceResult      { filename:string; file_url:string; face_count:number; confidences:number[]; bboxes:BBox[]; image_width:number; image_height:number }
export interface ContentResult   { filename:string; file_url:string; scene_concepts:string[]; relevance_scores:Record<string,number>; concept_match_score:number }
export interface HighlightResult { filename:string; file_url:string; highlights:HighlightClip[]; total_selected_seconds:number }

export interface Selection {
  filename:string; file_url:string
  intended_use:'collage'|'reel'|'story'|'case_study'
  confidence:number; low_confidence:boolean; selection_reason:string
  scores:{ quality:number; aesthetic:number; final:number }
  face_count:number; bboxes:BBox[]; scene_concepts:string[]
  asset_type:'image'|'video'; duration:number; highlight_clips:HighlightClip[]
}
export interface PipelineResult { event:string; total:number; selections:Selection[] }
export interface GenerateResult { event:string; output_dir:string; files:Record<string,string> }
export interface JobStatus      { job_id:string; status:string; progress?:{step?:string;pct?:number}; backend?:string; error?:string|null }

const fd = (files: File[], extra: Record<string,string> = {}) => {
  const f = new FormData()
  files.forEach(x => f.append('files', x))
  Object.entries(extra).forEach(([k,v]) => f.append(k,v))
  return f
}

export interface GenerateFastOptions {
  eventName: string
  eventDescription?: string
  mode?: 'standard' | 'gff'
  brands?: string[]
  selectedBrand?: string
  renderFilesByBrand?: File[][]
  generateReel?: boolean
}

export const checkHealth      = ()                                       => api.get<{status:string;version:string}>('/health').then(r=>r.data)
export const getModelStatus   = ()                                       => api.get<Record<string,string>>('/api/model-status').then(r=>r.data)
export const assessQuality    = (file:File)                              => { const f=new FormData(); f.append('file',file); return api.post<QualityResult>('/api/quality',f).then(r=>r.data) }
export const detectFaces      = (file:File)                              => { const f=new FormData(); f.append('file',file); return api.post<FaceResult>('/api/faces',f).then(r=>r.data) }
export const analyseContent   = (file:File)                              => { const f=new FormData(); f.append('file',file); return api.post<ContentResult>('/api/content',f).then(r=>r.data) }
export const extractHighlights= (file:File, dur=45)                     => { const f=new FormData(); f.append('file',file); return api.post<HighlightResult>(`/api/highlights?target_duration=${dur}`,f).then(r=>r.data) }
export const runPipeline      = (files:File[], desc:string)              => api.post<PipelineResult>('/api/pipeline', fd(files,{event_description:desc})).then(r=>r.data)
export const runPipelineAsync = (files:File[], desc:string)              => api.post<{job_id:string;status:string;backend:string}>('/api/pipeline/async', fd(files,{event_description:desc})).then(r=>r.data)
export const generateAsync    = (files:File[], name:string, desc:string) => api.post<{job_id:string;status:string;backend:string}>('/api/generate/async', fd(files,{event_name:name,event_description:desc})).then(r=>r.data)
export const generateFast     = (files:File[], opts:GenerateFastOptions) => {
  const f = fd(files, {
    event_name: opts.eventName,
    event_description: opts.eventDescription ?? opts.eventName,
    mode: opts.mode ?? 'standard',
    brands: JSON.stringify(opts.brands ?? []),
    selected_brand: opts.selectedBrand ?? '',
    generate_reel: String(opts.generateReel ?? false),
  })
  const renderBrandIds: string[] = []
  ;(opts.renderFilesByBrand ?? []).forEach((brandFiles, idx) => {
    const brand = opts.brands?.[idx] ?? ''
    brandFiles.forEach(file => {
      f.append('render_files', file)
      renderBrandIds.push(brand)
    })
  })
  f.append('render_brand_ids', JSON.stringify(renderBrandIds))
  return api.post<{job_id:string;status:string;backend:string}>('/api/generate/fast', f).then(r=>r.data)
}
export const getJobStatus     = (id:string)                              => api.get<JobStatus>(`/api/jobs/${id}/status`).then(r=>r.data)
export const getJobResult     = (id:string)                              => api.get<any>(`/api/jobs/${id}/result`).then(r=>r.data)

export interface RegenerateOptions {
  eventName: string
  eventDescription?: string
  platform?: 'linkedin' | 'instagram' | 'reel' | 'stories' | 'all'
  sceneConcepts?: string[]
  faceCount?: number
}
export interface RegenerateResult {
  backend: 'groq' | 'template' | 'local_llm'
  event: string
  linkedin?: string
  instagram?: string
  reel?: string
  stories?: string[]
}

export const regenerateCaptions = (opts: RegenerateOptions): Promise<RegenerateResult> => {
  const f = new FormData()
  f.append('event_name',        opts.eventName)
  f.append('event_description', opts.eventDescription ?? opts.eventName)
  f.append('platform',          opts.platform ?? 'all')
  f.append('scene_concepts',    (opts.sceneConcepts ?? []).join(','))
  f.append('face_count',        String(opts.faceCount ?? 0))
  return api.post<RegenerateResult>('/api/captions/regenerate', f).then(r => r.data)
}

// New types for asset selection
export interface CategorizedAsset {
  id: string
  url: string
  score: number
  face_count: number
  concepts: string[]
  category: string
}

export interface CategorizedAssetsResponse {
  job_id: string
  categories: Record<string, CategorizedAsset[]>
  category_counts: Record<string, number>
  top_assets: CategorizedAsset[]
  total_assets: number
}

export const getCategorizedAssets = (jobId: string) => 
  api.get<CategorizedAssetsResponse>(`/api/assets/categorized/${jobId}`).then(r => r.data)

export interface GenerateFromSelectedRequest {
  job_id: string
  selected_asset_ids: string[]
}

export const generateFromSelected = (jobId: string, selectedAssetIds: string[]) => 
  api.post<any>('/api/generate/from-selected', { job_id: jobId, selected_asset_ids: selectedAssetIds }).then(r => r.data)

// Enhanced types for new features
export interface EnhancedAsset {
  id: string
  url: string
  score: number
  faces: number
  concepts: string[]
}

export interface CategoryAssets {
  name: string
  icon: string
  assets: EnhancedAsset[]
}

export interface EnhancedAssetsResponse {
  job_id: string
  top_overall: EnhancedAsset[]
  per_category: Record<string, CategoryAssets>
  stats: { total: number; unique: number; deduped?: number; duplicates_removed?: number; pending_processing?: boolean; has_real_scores?: boolean }
}

export interface CustomGenerateRequest {
  job_id: string
  asset_ids: string[]
  linkedin_layout?: string
  story_layout?: string
  reel_layout?: string
}

export const getEnhancedAssets = (jobId: string) => 
  api.get<EnhancedAssetsResponse>(`/api/assets/enhanced/${jobId}`).then(r => r.data)

export const generateCustom = (req: CustomGenerateRequest) => 
  api.post<any>('/api/generate/custom', req).then(r => r.data)

export interface LayoutPreviewRequest {
  layout_type: 'linkedin' | 'story' | 'reel'
  layout_id: string
  asset_ids: string[]
  job_id: string
}

export const getLayoutPreview = (req: LayoutPreviewRequest) => 
  api.post<any>('/api/layout/preview', req).then(r => r.data)
