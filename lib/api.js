export const apiRequest = async (
  endpoint,
  method = "GET",
  body = null,
  token = null
) => {
  console.log(`API Request: ${method} /api${endpoint}`);
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  };

  try {
    const response = await fetch(
      `http://localhost:8080/api${endpoint}`,
      config
    );
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText || "Request failed" };
      }
      throw new Error(errorData.error || "Request failed");
    }
    return response.json();
  } catch (error) {
    console.error(`API Error: ${method} /api${endpoint} - ${error.message}`);
    throw error;
  }
};
