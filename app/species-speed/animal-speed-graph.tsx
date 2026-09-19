"use client";

import { max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { csv } from "d3-fetch";
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
import { select } from "d3-selection";
import { useEffect, useRef, useState } from "react";

type Diet = "carnivore" | "herbivore" | "omnivore";

interface AnimalDatum {
  name: string;
  speed: number;
  diet: Diet;
}

const VALID_DIETS: Diet[] = ["carnivore", "herbivore", "omnivore"];

export default function AnimalSpeedGraph() {
  const graphRef = useRef<HTMLDivElement>(null);

  const [animalData, setAnimalData] = useState<AnimalDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load and validate the cleaned CSV data.
  useEffect(() => {
    let cancelled = false;

    const loadAnimalData = async () => {
      try {
        setLoading(true);
        setError(null);

        const rows = await csv("/sample_animals.csv");

        const cleanedData: AnimalDatum[] = rows
          .map((row) => {
            const name = row.name?.trim();
            const speed = Number(row.speed);
            const diet = row.diet?.trim().toLowerCase() as Diet;

            if (!name || !Number.isFinite(speed) || !VALID_DIETS.includes(diet)) {
              return null;
            }

            return {
              name,
              speed,
              diet,
            };
          })
          .filter((animal): animal is AnimalDatum => animal !== null);

        if (!cancelled) {
          setAnimalData(cleanedData);
        }
      } catch (loadError) {
        console.error("Failed to load animal data:", loadError);

        if (!cancelled) {
          setError("Unable to load animal data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAnimalData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Draw the chart whenever the data changes.
  useEffect(() => {
    if (!graphRef.current || animalData.length === 0) {
      return;
    }

    graphRef.current.innerHTML = "";

    /*
     * Keep only the fastest entry for each animal name.
     * This prevents duplicate names from overlapping on the x-axis.
     * We display the top 30 to keep labels readable.
     */
    const fastestByAnimal = new Map<string, AnimalDatum>();

    animalData.forEach((animal) => {
      const existingAnimal = fastestByAnimal.get(animal.name);

      if (!existingAnimal || animal.speed > existingAnimal.speed) {
        fastestByAnimal.set(animal.name, animal);
      }
    });

    const chartData = Array.from(fastestByAnimal.values())
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 30);

    const containerWidth = graphRef.current.clientWidth || 800;
    const width = Math.max(containerWidth, 1000);
    const height = 560;

    const margin = {
      top: 85,
      right: 180,
      bottom: 125,
      left: 90,
    };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = select(graphRef.current)
      .append<SVGSVGElement>("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", "Bar chart comparing the speeds of animals by diet");

    const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = scaleBand<string>()
      .domain(chartData.map((animal) => animal.name))
      .range([0, chartWidth])
      .padding(0.2);

    const yScale = scaleLinear()
      .domain([0, max(chartData, (animal) => animal.speed) ?? 0])
      .nice()
      .range([chartHeight, 0]);

    const colorScale = scaleOrdinal<Diet, string>().domain(VALID_DIETS).range(["#dc2626", "#16a34a", "#2563eb"]);

    // X-axis
    chart
      .append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end")
      .style("font-size", "12px");

    // Y-axis
    chart.append("g").call(axisLeft(yScale));

    // Tooltip
    const tooltip = select(graphRef.current)
      .append("div")
      .style("position", "absolute")
      .style("opacity", "0")
      .style("pointer-events", "none")
      .style("background", "#111827")
      .style("color", "white")
      .style("border-radius", "6px")
      .style("padding", "8px 10px")
      .style("font-size", "13px")
      .style("white-space", "pre-line")
      .style("z-index", "10")
      .style("transition", "opacity 0.15s");

    // Bars
    chart
      .selectAll<SVGRectElement, AnimalDatum>("rect.bar")
      .data(chartData)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (animal) => xScale(animal.name) ?? 0)
      .attr("y", (animal) => yScale(animal.speed))
      .attr("width", xScale.bandwidth())
      .attr("height", (animal) => chartHeight - yScale(animal.speed))
      .attr("fill", (animal) => colorScale(animal.diet))
      .style("cursor", "pointer")
      .on("mouseover", function (event: MouseEvent, animal: AnimalDatum) {
        select(this).attr("opacity", 0.75).attr("stroke", "#111827").attr("stroke-width", 2);

        tooltip.text(`${animal.name}\nSpeed: ${animal.speed} km/h\nDiet: ${animal.diet}`).style("opacity", "1");
      })
      .on("mousemove", function (event: MouseEvent) {
        const containerRect = graphRef.current?.getBoundingClientRect();

        if (!containerRect) {
          return;
        }

        tooltip
          .style("left", `${event.clientX - containerRect.left + 12}px`)
          .style("top", `${event.clientY - containerRect.top + 12}px`);
      })
      .on("mouseout", function () {
        select(this).attr("opacity", 1).attr("stroke", "none");

        tooltip.style("opacity", "0");
      });
    // X-axis title
    chart
      .append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 110)
      .attr("text-anchor", "middle")
      .style("fill", "currentColor")
      .style("font-size", "14px")
      .text("Animal");

    // Y-axis title
    chart
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -60)
      .attr("text-anchor", "middle")
      .style("fill", "currentColor")
      .style("font-size", "14px")
      .text("Speed (km/h)");

    // Chart title
    chart
      .append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .style("fill", "currentColor")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .text("Animal Speed by Diet");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width - 150},${margin.top})`);

    VALID_DIETS.forEach((diet, index) => {
      const legendRow = legend.append("g").attr("transform", `translate(0,${index * 28})`);

      legendRow.append("rect").attr("width", 16).attr("height", 16).attr("rx", 2).attr("fill", colorScale(diet));

      legendRow
        .append("text")
        .attr("x", 24)
        .attr("y", 13)
        .style("fill", "currentColor")
        .style("font-size", "13px")
        .text(diet);
    });
  }, [animalData]);

  if (loading) {
    return <div className="rounded border p-8 text-center">Loading animal data...</div>;
  }

  if (error) {
    return <div className="rounded border border-red-300 p-8 text-center text-red-600">{error}</div>;
  }

  if (animalData.length === 0) {
    return <div className="rounded border p-8 text-center">No valid animal data was found.</div>;
  }

  return <div ref={graphRef} className="w-full overflow-x-auto rounded border bg-white p-4" />;
}
