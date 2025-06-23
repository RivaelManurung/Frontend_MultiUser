import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const AnalyticsChart = ({ projectId }) => {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await apiRequest(`/projects/${projectId}/analytics`, "GET", null, getToken());
        setAnalytics(data);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      }
    };
    fetchAnalytics();
  }, [projectId]);

  if (!analytics) return <p>Loading...</p>;

  const chartData = {
    labels: ["Todo", "In Progress", "Done"],
    datasets: [
      {
        label: "Tasks",
        data: [analytics.todo, analytics["in-progress"], analytics.done],
        backgroundColor: ["#FF6B6B", "#FFA500", "#4CAF50"],
      },
    ],
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Task Status Analytics</h3>
      <Bar data={chartData} />
    </div>
  );
};

export default AnalyticsChart;