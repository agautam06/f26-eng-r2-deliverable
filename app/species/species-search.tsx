"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/schema";
import SpeciesCard from "./species-card";

type Species = Database["public"]["Tables"]["species"]["Row"];

export default function SpeciesSearch({ species, sessionId }: { species: Species[]; sessionId: string }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSpecies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return species;
    }

    return species.filter((currentSpecies) => {
      const scientificName = currentSpecies.scientific_name.toLowerCase();
      const commonName = currentSpecies.common_name?.toLowerCase() ?? "";
      const description = currentSpecies.description?.toLowerCase() ?? "";

      return scientificName.includes(query) || commonName.includes(query) || description.includes(query);
    });
  }, [searchTerm, species]);

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="species-search" className="mb-2 block text-sm font-medium">
          Search species
        </label>

        <Input
          id="species-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or description..."
        />
      </div>

      {filteredSpecies.length === 0 ? (
        <p className="text-center text-muted-foreground">No species matched &quot;{searchTerm}&quot;.</p>
      ) : (
        <div className="flex flex-wrap justify-center">
          {filteredSpecies.map((currentSpecies) => (
            <SpeciesCard key={currentSpecies.id} species={currentSpecies} sessionId={sessionId} />
          ))}
        </div>
      )}
    </div>
  );
}
