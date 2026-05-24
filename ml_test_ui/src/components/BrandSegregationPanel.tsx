import { Image, Layers, X } from 'lucide-react'
import { Btn } from './ui'

interface BrandSegregationPanelProps {
  brands: string[]
  selectedBrand: string
  renderFilesByBrand: File[][]
  onBrandsChange: (brands: string[]) => void
  onSelectedBrandChange: (brand: string) => void
  onRenderFilesChange: (index: number, files: File[]) => void
}

const BRAND_COUNT = 4

export default function BrandSegregationPanel({
  brands,
  selectedBrand,
  renderFilesByBrand,
  onBrandsChange,
  onSelectedBrandChange,
  onRenderFilesChange,
}: BrandSegregationPanelProps) {
  const cleanBrands = brands.map(b => b.trim()).filter(Boolean)
  const readyCount = brands.filter((brand, i) => brand.trim() && (renderFilesByBrand[i]?.length ?? 0) > 0).length

  const updateBrand = (index: number, value: string) => {
    const next = [...brands]
    next[index] = value
    onBrandsChange(next)
    if (selectedBrand && !next.map(b => b.trim()).includes(selectedBrand)) {
      onSelectedBrandChange('')
    }
  }

  return (
    <div className="brand-panel">
      <div className="brand-panel__header">
        <div>
          <h3>Brand Segregation</h3>
          <p>Define four brands, upload render/logo references, then choose the brand to prioritize in the generated output.</p>
        </div>
        <div className="brand-panel__status">
          <Layers size={14} />
          {readyCount}/{BRAND_COUNT} ready
        </div>
      </div>

      <div className="brand-panel__grid">
        {Array.from({ length: BRAND_COUNT }).map((_, index) => {
          const brand = brands[index] ?? ''
          const renderFiles = renderFilesByBrand[index] ?? []
          return (
            <div className="brand-card" key={index}>
              <label className="brand-card__label" htmlFor={`brand-${index}`}>Brand {index + 1}</label>
              <input
                id={`brand-${index}`}
                className="brand-card__input"
                value={brand}
                onChange={e => updateBrand(index, e.target.value)}
                placeholder={`e.g. ${index === 0 ? 'HDFC Bank' : `Brand ${index + 1}`}`}
              />

              <label className="brand-render-upload">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => onRenderFilesChange(index, Array.from(e.target.files ?? []))}
                />
                <Image size={14} />
                {renderFiles.length ? `${renderFiles.length} render image${renderFiles.length > 1 ? 's' : ''}` : 'Upload render/logo images'}
              </label>

              {renderFiles.length > 0 && (
                <div className="brand-render-list">
                  {renderFiles.slice(0, 3).map(file => (
                    <span key={file.name + file.size}>{file.name}</span>
                  ))}
                  {renderFiles.length > 3 && <span>+{renderFiles.length - 3} more</span>}
                  <button
                    type="button"
                    aria-label={`Clear render images for ${brand || `brand ${index + 1}`}`}
                    onClick={() => onRenderFilesChange(index, [])}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="brand-panel__footer">
        <div className="brand-select">
          <label htmlFor="selected-brand">Content focus</label>
          <select
            id="selected-brand"
            value={selectedBrand}
            onChange={e => onSelectedBrandChange(e.target.value)}
          >
            <option value="">Select brand for content</option>
            {cleanBrands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
        <Btn
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onBrandsChange(['HDFC Bank', 'NPCI', 'Razorpay', 'Paytm'])
            onSelectedBrandChange('HDFC Bank')
          }}
        >
          Use GFF sample brands
        </Btn>
      </div>
    </div>
  )
}
