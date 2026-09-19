function CategoryTabs({ categories, activeId, onSelect }) {
  return (
    <div className="flex gap-6 md:gap-9 overflow-x-auto px-5 md:px-8 pb-1 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
      {categories.map((cat) => {
        const isActive = cat.id === activeId
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`relative whitespace-nowrap pb-3 text-[14.5px] font-semibold transition-colors ${
              isActive ? 'text-burgundy' : 'text-muted hover:text-ink'
            }`}
          >
            {cat.name}
            <span
              className={`absolute left-0 right-0 -bottom-px h-[2.5px] rounded-full transition-all ${
                isActive ? 'bg-gold scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export default CategoryTabs
