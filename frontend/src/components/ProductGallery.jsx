import { useRef, useState } from 'react'
import ResponsiveImage from './ResponsiveImage'

// Məhsul şəkilləri üçün üfüqi sürüşən (scroll-snap) qalereya; bir şəkil varsa adi şəkil kimi görünür.
function ProductGallery({ images = [], alt, className = 'h-80' }) {
  const scroller = useRef(null)
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return <div className={`w-full bg-blush ${className}`} />
  }

  function onScroll() {
    const el = scroller.current
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  function goTo(i) {
    const el = scroller.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        className={`flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
        data-testid="product-gallery"
      >
        {images.map((src, i) => (
          <div key={src} className="w-full h-full shrink-0 snap-center">
            <ResponsiveImage
              src={src}
              alt={images.length > 1 ? `${alt} ${i + 1}/${images.length}` : alt}
              sizes="(min-width: 768px) 768px, 100vw"
              loading={i === 0 ? undefined : 'lazy'}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-1.5" role="tablist">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}/${images.length}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductGallery
