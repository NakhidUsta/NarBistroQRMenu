import { imageVariants, resolveUploadUrl } from '../lib/api'

// Media Library şəkilləri üçün AVIF → WebP → orijinal ardıcıllığı ilə <picture>; digər URL-lər üçün adi <img>.
// `thumb` = kiçik kart şəkli (yalnız 240px WebP kifayətdir).
// desktopSizes — `thumb` rejimində telefonda kiçik (240px) şəkil, md+ ekranda isə daha iti orta/böyük variant (AVIF → WebP) yüklənir
function ResponsiveImage({ src, alt, sizes = '100vw', thumb = false, desktopSizes, className, loading, ...rest }) {
  const v = imageVariants(src)
  if (!v) return <img src={resolveUploadUrl(src)} alt={alt} loading={loading} className={className} {...rest} />
  if (thumb && desktopSizes) {
    const set = (a, b) => `${resolveUploadUrl(a)} 640w, ${resolveUploadUrl(b)} 1280w`
    return (
      <picture>
        <source media="(min-width: 768px)" type="image/avif" srcSet={set(v.mdAvif, v.lgAvif)} sizes={desktopSizes} />
        <source media="(min-width: 768px)" type="image/webp" srcSet={set(v.md, v.lg)} sizes={desktopSizes} />
        <img src={resolveUploadUrl(v.thumb)} alt={alt} loading={loading} className={className} {...rest} />
      </picture>
    )
  }
  if (thumb) return <img src={resolveUploadUrl(v.thumb)} alt={alt} loading={loading} className={className} {...rest} />
  const set = (a, b) => `${resolveUploadUrl(a)} 640w, ${resolveUploadUrl(b)} 1280w`
  return (
    <picture>
      <source type="image/avif" srcSet={set(v.mdAvif, v.lgAvif)} sizes={sizes} />
      <source type="image/webp" srcSet={set(v.md, v.lg)} sizes={sizes} />
      <img src={resolveUploadUrl(v.md)} alt={alt} loading={loading} className={className} {...rest} />
    </picture>
  )
}

export default ResponsiveImage
