"use client";

import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const AnalyticsChart = ({ projectId = "" }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await apiRequest(
          `/projects/${projectId}/analytics`,
          "GET",
          null,
          getToken()
        );

        const formattedData = {
          todo: 0,
          in_progress: 0,
          done: 0,
        };

        data.forEach((item) => {
          formattedData[item.status] = item._count.status;
        });

        setAnalytics(formattedData);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Gagal mengambil data analitik.");
      } finally {
        setLoading(false);
      }
    };

    if (projectId) fetchAnalytics();
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 animate-pulse">
        Memuat data analitik...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  const chartData = {
    labels: ["Todo", "In Progress", "Done"],
    datasets: [
      {
        label: "Jumlah Tugas",
        data: [analytics.todo, analytics.in_progress, analytics.done],
        backgroundColor: ["#F87171", "#FBBF24", "#34D399"],
        borderRadius: 6,
        barPercentage: 0.5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#4B5563",
          font: {
            size: 14,
          },
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#4B5563",
        },
        grid: {
          color: "#E5E7EB",
        },
      },
      y: {
        ticks: {
          color: "#4B5563",
        },
        grid: {
          color: "#E5E7EB",
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md dark:bg-zinc-900 dark:text-white">
      <h3 className="text-xl font-semibold mb-4">Analitik Status Tugas</h3>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
};

export default AnalyticsChart;
