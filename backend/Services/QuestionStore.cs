using System.Collections.Concurrent;
using System.Text.Json;
using Backend.Models;

namespace Backend.Services;

public class QuestionStore
{
    private readonly string _filePath;
    private readonly ILogger<QuestionStore> _logger;
    private List<QuestionItem> _questions = new();
    private readonly ReaderWriterLockSlim _lock = new(LockRecursionPolicy.NoRecursion);
    private volatile bool _isDirty = false;

    public QuestionStore(ILogger<QuestionStore> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _filePath = Path.Combine(env.ContentRootPath, "Data", "questions.json");
        LoadFromDisk();
    }

    public IReadOnlyList<QuestionItem> GetAll()
    {
        _lock.EnterReadLock();
        try
        {
            return _questions.ToList();
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public QuestionItem? GetById(string id)
    {
        _lock.EnterReadLock();
        try
        {
            return _questions.FirstOrDefault(q => q.Id == id);
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public QuestionItem Add(QuestionItem q)
    {
        if (string.IsNullOrWhiteSpace(q.Id))
            q = q with { Id = Guid.NewGuid().ToString("N")[..8] };

        _lock.EnterWriteLock();
        try
        {
            _questions.Add(q);
            _isDirty = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        SaveToDiskAsync();
        return q;
    }

    public bool Update(QuestionItem updated)
    {
        _lock.EnterWriteLock();
        try
        {
            var idx = _questions.FindIndex(q => q.Id == updated.Id);
            if (idx < 0) return false;
            _questions[idx] = updated;
            _isDirty = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        SaveToDiskAsync();
        return true;
    }

    public bool Delete(string id)
    {
        _lock.EnterWriteLock();
        try
        {
            var removed = _questions.RemoveAll(q => q.Id == id);
            if (removed == 0) return false;
            _isDirty = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        SaveToDiskAsync();
        return true;
    }

    public int BulkAdd(IEnumerable<QuestionItem> items)
    {
        int count = 0;
        _lock.EnterWriteLock();
        try
        {
            foreach (var item in items)
            {
                var q = string.IsNullOrWhiteSpace(item.Id)
                    ? item with { Id = Guid.NewGuid().ToString("N")[..8] }
                    : item;
                _questions.Add(q);
                count++;
            }
            _isDirty = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        SaveToDiskAsync();
        return count;
    }

    public void ImportAll(IEnumerable<QuestionItem> items)
    {
        _lock.EnterWriteLock();
        try
        {
            _questions = items.Select(q =>
                string.IsNullOrWhiteSpace(q.Id)
                    ? q with { Id = Guid.NewGuid().ToString("N")[..8] }
                    : q).ToList();
            _isDirty = true;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        SaveToDiskAsync();
    }

    private void LoadFromDisk()
    {
        try
        {
            var dir = Path.GetDirectoryName(_filePath)!;
            Directory.CreateDirectory(dir);

            if (!File.Exists(_filePath)) return;

            var json = File.ReadAllText(_filePath);
            var items = JsonSerializer.Deserialize<List<QuestionItem>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (items != null)
            {
                _lock.EnterWriteLock();
                try
                {
                    _questions = items;
                }
                finally
                {
                    _lock.ExitWriteLock();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Could not load questions.json: {Error}", ex.Message);
        }
    }

    private void SaveToDiskAsync()
    {
        if (!_isDirty) return;
        
        _ = Task.Run(() =>
        {
            try
            {
                List<QuestionItem> snapshot;
                _lock.EnterReadLock();
                try
                {
                    snapshot = _questions.ToList();
                    _isDirty = false;
                }
                finally
                {
                    _lock.ExitReadLock();
                }
                
                var dir = Path.GetDirectoryName(_filePath)!;
                Directory.CreateDirectory(dir);
                var json = JsonSerializer.Serialize(snapshot,
                    new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_filePath, json);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Could not save questions.json: {Error}", ex.Message);
            }
        });
    }
}

public record QuestionItem
{
    public string Id { get; init; } = "";
    public string Letter { get; init; } = "";
    public string Question { get; init; } = "";
    public string Answer { get; init; } = "";
    public string Category { get; init; } = "عام";
    public string Difficulty { get; init; } = "easy";
}
