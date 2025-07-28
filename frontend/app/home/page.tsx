"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

type Group = {
  id: string;
  name: string;
  roomId: string;
};

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [newGroups, setNewGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedId = localStorage.getItem('userId');
    if (!storedId) {
      router.push("/login");
    } else {
      setUserId(storedId);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchGroups = async () => {
      try {
        const res = await api.get(`/groups?userId=${userId}`);
        setJoinedGroups(res.data.joined || []);
        setNewGroups(res.data.notJoined || []);
      } catch (err) {
        console.error("Failed to fetch groups", err);
      }
    };

    fetchGroups();
  }, [userId]);

  const handleJoin = async (groupId: string) => {
    await api.post('/join-group', { userId, groupId });
    window.location.reload();
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || !userId) return;
    const res = await api.post('/create-group', {
      name: groupName,
      userId,
    });
    setShowModal(false);
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Welcome!</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create Group
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-2">Your Groups</h2>
      {joinedGroups.length === 0 ? (
        <p className="mb-6 text-gray-600">You haven't joined any groups yet.</p>
      ) : (
        <div className="grid gap-3 mb-6">
          {joinedGroups.map(group => (
            <div
              key={group.id}
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => router.push(`/group/${group.roomId}`)}
            >
              {group.name}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-2">Other Groups</h2>
      <div className="grid gap-3">
        {newGroups.map(group => (
          <div
            key={group.id}
            className="p-4 border rounded-lg flex justify-between items-center"
          >
            <span>{group.name}</span>
            <button
              onClick={() => handleJoin(group.id)}
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Join
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-4">Create Group</h2>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}