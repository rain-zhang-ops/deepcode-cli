import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { getTodoService, type Todo } from "../services/TodoService";

type TodoPanelProps = {
  projectRoot: string;
  sessionId: string | null;
  visible: boolean;
};

const STATUS_ICON: Record<Todo["status"], string> = {
  pending: "☐",
  in_progress: "▶",
  completed: "☑"
};

const STATUS_COLOR: Record<Todo["status"], string> = {
  pending: "white",
  in_progress: "cyan",
  completed: "gray"
};

export function TodoPanel({ projectRoot, sessionId, visible }: TodoPanelProps): React.ReactElement | null {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setTodos([]);
      return;
    }

    // Load initial todos
    const initial = getTodoService().getTodos(projectRoot, sessionId);
    setTodos(initial);

    // Subscribe to future updates
    const unsubscribe = getTodoService().subscribe(sessionId, (updated) => {
      setTodos(updated);
    });

    return unsubscribe;
  }, [projectRoot, sessionId]);

  if (!visible || todos.length === 0) {
    return null;
  }

  const pendingOrActive = todos.filter((t) => t.status !== "completed");
  const completed = todos.filter((t) => t.status === "completed");

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={0}>
      <Text bold color="cyan">TODO</Text>
      {pendingOrActive.map((todo) => (
        <Box key={todo.id} flexDirection="row" gap={1}>
          <Text color={STATUS_COLOR[todo.status]}>
            {STATUS_ICON[todo.status]}
          </Text>
          <Text
            bold={todo.status === "in_progress"}
            color={STATUS_COLOR[todo.status]}
            strikethrough={false}
          >
            {todo.content}
          </Text>
        </Box>
      ))}
      {completed.length > 0 && (
        completed.map((todo) => (
          <Box key={todo.id} flexDirection="row" gap={1}>
            <Text color={STATUS_COLOR[todo.status]}>{STATUS_ICON[todo.status]}</Text>
            <Text color={STATUS_COLOR[todo.status]}>{todo.content}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
