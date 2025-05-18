import React from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { WebSocketEvent } from "@/features/websocket/types";
import { IPage } from "@/features/page/types/page.types";

export const useQuerySubscription = () => {
  const queryClient = useQueryClient();
  const [socket] = useAtom(socketAtom);

  React.useEffect(() => {
    socket?.on("message", (event) => {
      const data: WebSocketEvent = event;

      let entity = null;
      let queryKeyId = null;

      switch (data.operation) {
        case "invalidate":
          queryClient.invalidateQueries({
            queryKey: [...data.entity, data.id].filter(Boolean),
          });
          break;
        case "updateOne":
          entity = data.entity[0];
          if (entity === "pages") {
            const pageById = queryClient.getQueryData<IPage>([
              ...data.entity,
              data.id,
            ]);
            const pageBySlug = queryClient.getQueryData<IPage>([
              ...data.entity,
              data.payload.slugId,
            ]);

            if (pageById) {
              queryClient.setQueryData<IPage>([...data.entity, data.id], {
                ...pageById,
                ...data.payload,
              });
            }

            if (pageBySlug) {
              queryClient.setQueryData<IPage>(
                [...data.entity, data.payload.slugId],
                {
                  ...pageBySlug,
                  ...data.payload,
                },
              );
            }

            queryClient.invalidateQueries({
              queryKey: ["pages", data.id],
            });

            if (data.payload.slugId) {
              queryClient.invalidateQueries({
                queryKey: ["pages", data.payload.slugId],
              });
            }
          } else {
            queryKeyId = data.id;
            if (queryClient.getQueryData([...data.entity, queryKeyId])) {
              queryClient.setQueryData([...data.entity, queryKeyId], {
                ...queryClient.getQueryData([...data.entity, queryKeyId]),
                ...data.payload,
              });
            }
          }
          break;
      }
    });

    return () => {
      socket?.off("message");
    };
  }, [queryClient, socket]);
};
