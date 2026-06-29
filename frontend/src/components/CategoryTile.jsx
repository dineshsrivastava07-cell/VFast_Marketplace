import React from "react";
import { Link } from "react-router-dom";

export default function CategoryTile({ cat }) {
  return (
    <Link
      to={`/c/${cat.slug}`}
      data-testid={`category-tile-${cat.slug}`}
      className="cat-tile relative rounded-2xl overflow-hidden border border-gray-100 h-28 sm:h-36"
      style={{ backgroundColor: cat.tint || "#F9FAFB" }}
    >
      <div className="absolute top-2 left-2 right-2 font-display font-bold text-sm text-gray-900 leading-tight">
        {cat.name}
      </div>
      {cat.image && (
        <img
          src={cat.image}
          alt={cat.name}
          loading="lazy"
          className="absolute -right-2 -bottom-2 w-[75%] h-[70%] object-cover rounded-tl-2xl shadow-md"
        />
      )}
    </Link>
  );
}
