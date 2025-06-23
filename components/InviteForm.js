import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";

const InviteForm = ({ projectId }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const data = await apiRequest(`/projects/search-users?query=${query}`, "GET", null, getToken());
        setSuggestions(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchSuggestions();
  }, [query]);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/projects/${projectId}/invite`, "POST", { email }, getToken());
      setEmail("");
      setSuggestions([]);
      alert("Member invited!");
    } catch (error) {
      console.error("Error inviting member:", error);
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleInvite} className="space-y-4">
      <div className="relative">
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setQuery(e.target.value);
          }}
          placeholder="Enter email"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border rounded mt-1 max-h-40 overflow-y-auto">
            {suggestions.map((user) => (
              <li
                key={user.id}
                onClick={() => {
                  setEmail(user.email);
                  setSuggestions([]);
                }}
                className="p-2 hover:bg-gray-100 cursor-pointer"
              >
                {user.email}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="submit">Invite</Button>
    </form>
  );
};

export default InviteForm;