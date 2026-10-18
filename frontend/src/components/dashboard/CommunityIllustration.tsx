export function CommunityIllustration() {
  return (
    <div className="community-art" aria-hidden="true">
      <svg viewBox="0 0 440 310" fill="none">
        <defs>
          <pattern id="mapgrid" width="35" height="35" patternUnits="userSpaceOnUse">
            <path d="M35 0H0V35" stroke="white" strokeOpacity=".10" />
          </pattern>
          <linearGradient id="mapfade" x1="80" y1="0" x2="400" y2="300">
            <stop stopColor="white" stopOpacity=".15" />
            <stop offset="1" stopColor="white" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <rect
          x="10"
          y="10"
          width="420"
          height="290"
          rx="28"
          fill="url(#mapgrid)"
          transform="rotate(-8 220 155)"
        />
        <path
          d="m40 184 70-82 66 38 54-86 55 64 112-40M44 255l84-53 73 42 65-73 125 64M109 23l28 266M303 15l-34 277"
          stroke="white"
          strokeOpacity=".14"
          strokeWidth="9"
          strokeLinejoin="round"
        />
        <circle cx="245" cy="151" r="96" stroke="white" strokeOpacity=".12" />
        <circle cx="245" cy="151" r="66" stroke="white" strokeOpacity=".15" strokeDasharray="4 6" />
        <path
          d="M111 207c51 0 57-99 128-63s79-9 108-43"
          stroke="#FFE0B7"
          strokeWidth="2.5"
          strokeDasharray="5 6"
        />
        <circle cx="111" cy="207" r="7" fill="white" />
        <circle cx="111" cy="207" r="14" stroke="white" strokeOpacity=".35" />
        <g transform="translate(210 79)">
          <path
            d="M35 0C15 0 0 16 0 35c0 27 35 54 35 54s35-27 35-54C70 16 55 0 35 0Z"
            fill="white"
          />
          <path d="m19 35 16-14 16 14v19H39V42h-8v12H19V35Z" fill="#EB5C30" />
        </g>
        <g transform="rotate(-6 90 90)">
          <rect x="13" y="44" width="155" height="59" rx="14" fill="white" />
          <circle cx="43" cy="74" r="16" fill="#FFF0E8" />
          <path d="m37 74 4 4 8-9" stroke="#E96137" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="69" y="63" width="73" height="6" rx="3" fill="#374151" />
          <rect x="69" y="77" width="56" height="5" rx="2.5" fill="#CBD5E1" />
        </g>
        <g transform="rotate(5 337 233)">
          <rect x="259" y="207" width="164" height="64" rx="14" fill="white" />
          <circle cx="288" cy="239" r="17" fill="#EAF7EF" />
          <path d="m280 239 8-7 8 7v9h-6v-6h-4v6h-6v-9Z" stroke="#38976A" strokeWidth="1.7" />
          <text x="315" y="236" fontSize="10" fontWeight="700" fill="#283541">
            A community that cares
          </text>
          <text x="315" y="251" fontSize="9" fill="#78869A">
            Every connection counts
          </text>
        </g>
        <g transform="translate(342 69)">
          <circle cx="0" cy="0" r="21" fill="white" fillOpacity=".2" />
          <path d="M0 9S-10 3-10-3C-10-10-2-11 0-6c3-5 10-4 10 3C10 3 0 9 0 9Z" fill="white" />
        </g>
        <circle cx="190" cy="245" r="4" fill="#FFD5A8" />
        <circle cx="389" cy="162" r="4" fill="white" fillOpacity=".6" />
      </svg>
    </div>
  )
}
