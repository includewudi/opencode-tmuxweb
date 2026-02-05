import Foundation

public class HostStore: ObservableObject {
    @Published public private(set) var hosts: [HostModel] = []
    
    public init() {
        load()
    }
    
    public func add(_ host: HostModel) {
        hosts.append(host)
        save()
    }
    
    public func update(_ host: HostModel) {
        if let index = hosts.firstIndex(where: { $0.id == host.id }) {
            hosts[index] = host
            save()
        }
    }
    
    public func remove(at offsets: IndexSet) {
        hosts.remove(atOffsets: offsets)
        save()
    }
    
    public func delete(hostId: UUID) {
        hosts.removeAll { $0.id == hostId }
        save()
    }
    
    private func save() {
        if let data = try? JSONEncoder().encode(hosts) {
            UserDefaults.standard.set(data, forKey: "savedHosts")
        }
    }
    
    private func load() {
        if let data = UserDefaults.standard.data(forKey: "savedHosts"),
           let decoded = try? JSONDecoder().decode([HostModel].self, from: data) {
            hosts = decoded
        }
    }
}
