export function refreshAccountQueries(queryClient, session, { library = true, tags = true } = {}) {
    if (session.signal.aborted) return

    const refresh = []
    if (library) refresh.push(queryClient.invalidateQueries({ queryKey: ["library", session.userId] }))
    if (tags) refresh.push(queryClient.invalidateQueries({ queryKey: ["tags", session.userId] }))
    return Promise.all(refresh)
}
