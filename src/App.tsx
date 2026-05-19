import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw,
  Folder,
  PlayCircle,
  Video,
  Users,
  Archive,
  ShieldCheck,
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Search, 
  Plus, 
  X, 
  Maximize2, 
  Tag as TagIcon,
  Download,
  Calendar,
  Info,
  Menu,
  Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Separator } from '@/components/ui/separator';
import { Toaster, toast } from 'sonner';

interface Photo {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  tags: string[];
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('tsm_auth_v1') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'all' | 'favorites' | 'trash' | 'updates' | 'albums' | 'videos' | 'shared' | 'archive' | 'vault'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPhotos();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.username === 'com' && loginForm.password === 'com') {
      setIsAuthenticated(true);
      sessionStorage.setItem('tsm_auth_v1', 'true');
      toast.success('ยินดีต้อนรับเข้าสู่ TSM Photo');
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      toast.error('การเข้าสู่ระบบล้มเหลว');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('tsm_auth_v1');
    toast.info('ออกจากระบบเรียบร้อยแล้ว');
  };

  const fetchPhotos = async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch (error) {
      toast.error('ไม่สามารถโหลดรูปภาพได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl.trim()) return;
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/photos/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadUrl.trim() }),
      });

      if (res.ok) {
        const newPhotos = await res.json();
        setPhotos([...newPhotos, ...photos]);
        setIsUploadOpen(false);
        setUploadUrl('');
        toast.success(`บันทึกรูปภาพจากลิงก์เรียบร้อยแล้ว`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'การดาวน์โหลดล้มเหลว ลิงก์อาจไม่ถูกต้อง');
      }
    } catch (error) {
      toast.error('การทำรายการล้มเหลว');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((file: any) => file.type.startsWith('image/')) as File[];
    
    if (fileList.length === 0) {
      toast.error('ไม่พบไฟล์รูปภาพที่สามารถอัปโหลดได้');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    fileList.forEach(file => {
      formData.append('photos', file);
    });

    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const newPhotos = await res.json();
        setPhotos([...newPhotos, ...photos]);
        setIsUploadOpen(false);
        toast.success(`อัปโหลดรูปภาพ ${newPhotos.length} รูปเรียบร้อยแล้ว`);
      } else {
        toast.error('การอัปโหลดล้มเหลว');
      }
    } catch (error) {
      toast.error('การอัปโหลดล้มเหลว');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleUploadFiles(e.target.files);
  };

  const handleBatchDownload = async () => {
    if (selectedIds.length === 0) return;
    
    const photosToDownload = photos.filter(p => selectedIds.includes(p.id));
    
    toast.info(`กำลังเตรียมการดาวน์โหลด ${photosToDownload.length} รูปภาพ...`);
    
    for (const photo of photosToDownload) {
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = photo.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        // Small delay to prevent browser blocking or overwhelming
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error('Download failed for', photo.name, err);
      }
    }
    
    toast.success('ดาวน์โหลดเรียบร้อยแล้ว');
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพทั้ง ${selectedIds.length} รูปที่เลือกไว้?`)) return;

    toast.promise(
      Promise.all(selectedIds.map(id => fetch(`/api/photos/${id}`, { method: 'DELETE' }))),
      {
        loading: 'กำลังลบรูปภาพ...',
        success: () => {
          setPhotos(photos.filter(p => !selectedIds.includes(p.id)));
          setSelectedIds([]);
          setIsSelectionMode(false);
          return 'ลบรูปภาพทั้งหมดที่เลือกแล้ว';
        },
        error: 'เกิดข้อผิดพลาดในการลบบางรายการ',
      }
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปภาพนี้?')) return;

    try {
      const res = await fetch(`/api/photos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPhotos(photos.filter(p => p.id !== id));
        setSelectedPhoto(null);
        toast.success('ลบรูปภาพเรียบร้อยแล้ว');
      } else {
        toast.error('ไม่สามารถลบรูปภาพได้');
      }
    } catch (error) {
      toast.error('ไม่สามารถลบรูปภาพได้');
    }
  };

  const handleAiTag = async (id: string) => {
    toast.promise(
      fetch(`/api/photos/${id}/tag`, { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) throw new Error();
          const updatedPhoto = await res.json();
          setPhotos(photos.map(p => p.id === id ? updatedPhoto : p));
          setSelectedPhoto(updatedPhoto);
          return updatedPhoto;
        }),
      {
        loading: 'กำลังวิเคราะห์รูปภาพด้วย AI...',
        success: 'เพิ่มแท็กด้วย AI สำเร็จ',
        error: 'เกิดข้อผิดพลาดในการวิเคราะห์ AI',
      }
    );
  };

  const filteredPhotos = photos.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory ? p.tags.includes(selectedCategory) : true;
    
    // For now, view filtering is mocked
    if (['favorites', 'trash', 'updates', 'albums', 'videos', 'shared', 'archive', 'vault'].includes(currentView)) {
      if (currentView === 'all') return matchesSearch && matchesCategory;
      return false; // Mock empty for other views
    }
    
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const allTags = Array.from(new Set(photos.flatMap(p => p.tags))).sort();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white font-sans selection:bg-purple-500/30 relative overflow-hidden flex items-center justify-center p-4">
        <Toaster position="top-center" richColors theme="dark" />
        {/* Background Mesh Gradients */}
        <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md z-10"
        >
          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[40px] shadow-2xl">
            <div className="flex flex-col items-center mb-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-6">
                <ImageIcon className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tighter">TSM Photo</h1>
              <p className="text-white/40 font-medium mt-2">กรุณาเข้าสู่ระบบเพื่อจัดการคลังภาพ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/30 uppercase tracking-widest pl-1">ชื่อผู้ใช้</label>
                <Input 
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="Username" 
                  className="bg-white/5 border-white/10 h-12 rounded-2xl focus:bg-white/10 transition-all focus-visible:ring-0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/30 uppercase tracking-widest pl-1">รหัสผ่าน</label>
                <Input 
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Password" 
                  className="bg-white/5 border-white/10 h-12 rounded-2xl focus:bg-white/10 transition-all focus-visible:ring-0"
                />
              </div>
              
              {loginError && (
                <p className="text-red-400 text-xs font-bold text-center animate-pulse">{loginError}</p>
              )}

              <Button 
                type="submit" 
                className="w-full bg-white text-[#0f1115] hover:bg-white/90 h-14 rounded-2xl font-bold text-lg mt-6 shadow-xl shadow-white/5 active:scale-[0.98] transition-all"
              >
                เข้าสู่ระบบ
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0f1115] text-white font-sans selection:bg-purple-500/30 relative overflow-hidden flex"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Toaster position="top-center" richColors theme="dark" />

      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-purple-600/20 backdrop-blur-xl flex items-center justify-center border-8 border-dashed border-white/20 m-4 rounded-[40px] pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white text-purple-600 flex items-center justify-center shadow-2xl mb-6">
                <Upload className="h-12 w-12 animate-bounce" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter">วางเพื่ออัปโหลดทันที</h2>
              <p className="text-white/60 font-bold mt-2">ปล่อยเมาส์เพื่อเพิ่มรูปภาพลงในคลังของคุณ</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed inset-y-0 left-0 w-72 flex flex-col p-6 z-50 border-r border-white/10 backdrop-blur-3xl bg-[#0f1115]/95 lg:hidden overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="font-bold text-2xl tracking-tighter">TSM Photo</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="text-white/50 hover:text-white hover:bg-white/10 rounded-full">
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <nav className="space-y-8 mt-2">
                <div>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">คลังภาพ</p>
                  <ul className="space-y-1.5 focus:outline-none">
                    <li 
                      onClick={() => {
                        setSelectedCategory(null);
                        setCurrentView('all');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition-all ${
                        currentView === 'all' && !selectedCategory 
                          ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/20" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    > 
                      <ImageIcon className={`h-4 w-4 ${currentView === 'all' && !selectedCategory ? "text-blue-400" : "text-white/20"}`} />
                      รูปภาพ
                    </li>
                    <li 
                      onClick={() => { setCurrentView('updates'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'updates' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <RefreshCw className={`h-4 w-4 ${currentView === 'updates' ? "text-green-400" : "text-white/20"}`} />
                      อัพเดต
                    </li>
                    <li 
                      onClick={() => { setCurrentView('albums'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'albums' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Folder className={`h-4 w-4 ${currentView === 'albums' ? "text-amber-400" : "text-white/20"}`} />
                      อัลบั้ม
                    </li>
                    <li 
                      onClick={() => { setCurrentView('videos'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'videos' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <PlayCircle className={`h-4 w-4 ${currentView === 'videos' ? "text-red-400" : "text-white/20"}`} />
                      วีดีโอ
                    </li>
                    <li 
                      onClick={() => { setCurrentView('shared'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'shared' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Users className={`h-4 w-4 ${currentView === 'shared' ? "text-cyan-400" : "text-white/20"}`} />
                      แชร์กับฉัน
                    </li>
                    <li 
                      onClick={() => { setCurrentView('archive'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'archive' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Archive className={`h-4 w-4 ${currentView === 'archive' ? "text-indigo-400" : "text-white/20"}`} />
                      คลังจัดเก็บ
                    </li>
                    <li 
                      onClick={() => { setCurrentView('vault'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'vault' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <ShieldCheck className={`h-4 w-4 ${currentView === 'vault' ? "text-emerald-400" : "text-white/20"}`} />
                      ห้องนิรภัย
                    </li>
                    <li 
                      onClick={() => { setCurrentView('favorites'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'favorites' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      รายการโปรด
                    </li>
                    <li 
                      onClick={() => { setCurrentView('trash'); setIsMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        currentView === 'trash' 
                          ? "bg-white/10 text-white border-white/10" 
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      ถูกลบล่าสุด
                    </li>
                    <li 
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-500/10"
                    >
                      ออกจากระบบ
                    </li>
                  </ul>
                </div>

                {allTags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">หมวดหมู่</p>
                    <ScrollArea className="h-[200px] -mx-2 px-2">
                      <ul className="space-y-1.5 focus:outline-none">
                        {allTags.map(tag => (
                          <li 
                            key={tag}
                            onClick={() => { setSelectedCategory(tag === selectedCategory ? null : tag); setIsMobileMenuOpen(false); }}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition-all capitalize ${
                              selectedCategory === tag
                                ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/20"
                                : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <TagIcon className={`h-4 w-4 ${selectedCategory === tag ? "text-purple-400" : "text-white/20"}`} />
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop Only */}
      <aside className="w-64 h-screen sticky top-0 hidden lg:flex flex-col p-6 z-20 border-r border-white/10 backdrop-blur-3xl bg-white/5">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-2xl tracking-tighter">TSM Photo</span>
        </div>

        <nav className="space-y-8">
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">คลังภาพ</p>
            <ul className="space-y-1.5 focus:outline-none">
              <li 
                onClick={() => {
                  setSelectedCategory(null);
                  setCurrentView('all');
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition-all ${
                  currentView === 'all' && !selectedCategory 
                    ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/20" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              > 
                <ImageIcon className={`h-4 w-4 ${currentView === 'all' && !selectedCategory ? "text-blue-400" : "text-white/20"}`} />
                รูปภาพ
              </li>
              <li 
                onClick={() => setCurrentView('updates')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'updates' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${currentView === 'updates' ? "text-green-400" : "text-white/20"}`} />
                อัพเดต
              </li>
              <li 
                onClick={() => setCurrentView('albums')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'albums' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <Folder className={`h-4 w-4 ${currentView === 'albums' ? "text-amber-400" : "text-white/20"}`} />
                อัลบั้ม
              </li>
              <li 
                onClick={() => setCurrentView('videos')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'videos' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <PlayCircle className={`h-4 w-4 ${currentView === 'videos' ? "text-red-400" : "text-white/20"}`} />
                วีดีโอ
              </li>
              <li 
                onClick={() => setCurrentView('shared')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'shared' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <Users className={`h-4 w-4 ${currentView === 'shared' ? "text-cyan-400" : "text-white/20"}`} />
                แชร์กับฉัน
              </li>
              <li 
                onClick={() => setCurrentView('archive')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'archive' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <Archive className={`h-4 w-4 ${currentView === 'archive' ? "text-indigo-400" : "text-white/20"}`} />
                คลังจัดเก็บ
              </li>
              <li 
                onClick={() => setCurrentView('vault')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'vault' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <ShieldCheck className={`h-4 w-4 ${currentView === 'vault' ? "text-emerald-400" : "text-white/20"}`} />
                ห้องนิรภัย
              </li>
              <li 
                onClick={() => setCurrentView('favorites')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'favorites' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                รายการโปรด
              </li>
              <li 
                onClick={() => setCurrentView('trash')}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all cursor-pointer border ${
                  currentView === 'trash' 
                    ? "bg-white/10 text-white border-white/10" 
                    : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                ถูกลบล่าสุด
              </li>
              <li 
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-500/10"
              >
                ออกจากระบบ
              </li>
            </ul>
          </div>

          {allTags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">หมวดหมู่</p>
              <ScrollArea className="h-[200px] -mx-2 px-2">
                <ul className="space-y-1.5 focus:outline-none">
                  {allTags.map(tag => (
                    <li 
                      key={tag}
                      onClick={() => setSelectedCategory(tag === selectedCategory ? null : tag)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium border cursor-pointer transition-all capitalize ${
                        selectedCategory === tag
                          ? "bg-white/10 text-white border-white/10 shadow-lg shadow-black/20"
                          : "text-white/50 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <TagIcon className={`h-4 w-4 ${selectedCategory === tag ? "text-purple-400" : "text-white/20"}`} />
                      {tag}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">พื้นที่จัดเก็บ</p>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white/60">พื้นที่คลาวด์ที่ใช้</span>
                <span className="font-semibold">{formatSize(photos.reduce((acc, p) => acc + p.size, 0))}</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "35%" }}
                  className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full" 
                />
              </div>
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 text-white/40 text-xs">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>ระบบ AI พร้อมใช้งาน</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 z-30 border-b border-white/5 backdrop-blur-md bg-[#0f1115]/50 sticky top-0 gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden shrink-0 text-white hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 transition-colors group-focus-within:text-white/60" />
              <Input 
                placeholder="ค้นหาความทรงจำของคุณ..." 
                className="w-full bg-white/5 border-white/10 rounded-full py-2 pl-12 h-11 focus:border-white/20 focus:bg-white/10 text-white placeholder:text-white/20 transition-all focus-visible:ring-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <Button 
              variant="default" 
              onClick={() => setIsUploadOpen(true)}
              className="bg-white text-[#0f1115] hover:bg-white/90 font-bold rounded-full h-11 px-4 lg:px-8 transition-all active:scale-95 shadow-xl shadow-white/5"
            >
              <Upload className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">อัปโหลดรูปภาพ</span>
            </Button>
          </div>
        </header>

        <main className="p-4 lg:p-8 pb-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 lg:mb-10 gap-6">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-2">
                {currentView === 'favorites' ? 'รายการโปรด' : 
                 currentView === 'trash' ? 'ถูกลบล่าสุด' :
                 currentView === 'updates' ? 'รายการอัพเดต' :
                 currentView === 'albums' ? 'อัลบั้ม' :
                 currentView === 'videos' ? 'วีดีโอ' :
                 currentView === 'shared' ? 'แชร์กับฉัน' :
                 currentView === 'archive' ? 'คลังจัดเก็บ' :
                 currentView === 'vault' ? 'ห้องนิรภัย' :
                 selectedCategory ? `ภาพ: ${selectedCategory}` : 'รูปล่าสุด'}
              </h2>
              <p className="text-white/40 text-sm font-medium tracking-wide flex items-center gap-2">
                <span>{filteredPhotos.length} รายการ</span>
                {selectedIds.length > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="text-purple-400 font-bold">เลือกอยู่ {selectedIds.length} รายการ</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span>อัปเดตล่าสุดเมื่อครู่</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isSelectionMode ? (
                <>
                  <Button 
                    variant="ghost" 
                    className="text-white hover:bg-white/5 font-bold"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedIds([]);
                    }}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    variant="outline" 
                    className="bg-white/10 border-white/20 hover:bg-white/20 text-white font-bold rounded-xl"
                    disabled={selectedIds.length === 0}
                    onClick={handleBatchDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    ดาวน์โหลด ({selectedIds.length})
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="bg-red-500 hover:bg-red-600 font-bold rounded-xl"
                    disabled={selectedIds.length === 0}
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    ลบทั้งหมด ({selectedIds.length})
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white font-bold rounded-xl"
                  onClick={() => setIsSelectionMode(true)}
                >
                  เลือกรายการ
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 border border-white/5 animate-pulse rounded-[32px] backdrop-blur-md" />
              ))}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="bg-white/5 backdrop-blur-3xl p-12 rounded-full mb-6 border border-white/10">
                <ImageIcon className="h-16 w-16 text-white/10" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">ไม่มีข้อมูลให้แสดง</h3>
              <p className="text-white/30 max-w-sm font-medium">
                {searchTerm ? 'ไม่พบรูปภาพที่คุณกำลังค้นหา' : 'เริ่มต้นสร้างคลังรูปภาพของคุณด้วยการอัปโหลดไฟล์แรก'}
              </p>
            </div>
          ) : (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {filteredPhotos.map((photo) => (
                    <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -8 }}
                    className="group relative"
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleSelect(photo.id);
                      } else {
                        setSelectedPhoto(photo);
                      }
                    }}
                  >
                    <div className={`relative aspect-square rounded-[32px] overflow-hidden bg-white/5 border transition-all duration-500 cursor-pointer ${
                      selectedIds.includes(photo.id) 
                        ? "border-purple-500 ring-2 ring-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]" 
                        : "border-white/10 group-hover:border-white/30 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    }`}>
                      <img 
                        src={photo.url} 
                        alt={photo.name}
                        className={`object-cover w-full h-full transition-transform duration-700 ${
                          selectedIds.includes(photo.id) ? "scale-90" : "group-hover:scale-110"
                        }`}
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Selection Checkmark */}
                      {isSelectionMode && (
                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          selectedIds.includes(photo.id) ? "bg-purple-500 scale-110" : "bg-black/40 border border-white/20"
                        }`}>
                          <div className={`w-2 h-2 rounded-full bg-white transition-opacity ${selectedIds.includes(photo.id) ? "opacity-100" : "opacity-0"}`} />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                        <p className="text-sm font-bold truncate leading-tight">{photo.name}</p>
                        <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">
                          {photo.type.split('/')[1]} • {formatSize(photo.size)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </main>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md bg-[#1a1c22] border-white/10 text-white rounded-[40px] shadow-2xl p-8 backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-extrabold tracking-tighter">อัปโหลด</DialogTitle>
            <DialogDescription className="text-white/40 font-medium">
              ลากและวางรูปภาพของคุณที่นี่เพื่อเริ่มต้น
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div 
              className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[32px] py-12 px-4 transition-all hover:border-white/30 hover:bg-white/5 cursor-pointer group relative overflow-hidden"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.webkitdirectory = false;
                  fileInputRef.current.click();
                }
              }}
            >
              <div className="bg-white/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                {isUploading ? (
                  <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-white" />
                )}
              </div>
              <p className="text-sm font-bold">เลือกไฟล์</p>
              <p className="text-[10px] text-white/30 mt-1 font-medium text-center">เลือกหลายไฟล์ได้</p>
            </div>

            <div 
              className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[32px] py-12 px-4 transition-all hover:border-white/30 hover:bg-white/5 cursor-pointer group relative overflow-hidden"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.webkitdirectory = true;
                  fileInputRef.current.click();
                }
              }}
            >
              <div className="bg-white/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                {isUploading ? (
                  <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-white" />
                )}
              </div>
              <p className="text-sm font-bold">เลือกโฟลเดอร์</p>
              <p className="text-[10px] text-white/30 mt-1 font-medium text-center">อัปโหลดทั้งโฟลเดอร์</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="relative flex items-center mb-6">
              <div className="flex-1 border-t border-white/10"></div>
              <span className="px-4 text-xs text-white/40 font-medium">หรือเพิ่มด้วยลิงก์</span>
              <div className="flex-1 border-t border-white/10"></div>
            </div>

            <form onSubmit={handleUrlUpload} className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input 
                  type="url"
                  placeholder="วางลิงก์รูปภาพหรือ Google Drive (เช่น drive.google.com/...)"
                  className="pl-11 h-12 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/30 focus-visible:ring-purple-500"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              <Button 
                type="submit"
                disabled={!uploadUrl.trim() || isUploading}
                className="h-12 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 font-bold"
              >
                {isUploading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'เพิ่มรูป'}
              </Button>
            </form>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[10px] text-white/20 font-medium">JPEG, PNG, GIF, WebP รองรับสูงสุด 50 ไฟล์ต่อครั้ง</p>
            <input 
              type="file" 
              ref={(el) => {
                fileInputRef.current = el;
                if (el) {
                  // TypeScript workaround for webkitdirectory
                  el.setAttribute('webkitdirectory', '');
                  el.setAttribute('directory', '');
                }
              }}
              className="hidden" 
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={isUploading}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        {selectedPhoto && (
          <DialogContent className="max-w-screen-xl w-[95vw] h-[90vh] p-0 overflow-hidden border-none bg-black/95 flex flex-col lg:flex-row rounded-[40px] shadow-none outline-none">
            {/* Viewer */}
            <div className="flex-1 relative flex items-center justify-center bg-transparent backdrop-blur-3xl group">
              <img 
                src={selectedPhoto.url} 
                alt={selectedPhoto.name}
                className="max-h-full max-w-full object-contain p-8 group-hover:scale-[1.02] transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute top-8 right-8 text-white/30 hover:text-white hover:bg-white/10 rounded-full h-12 w-12 lg:hidden"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-8 w-8" />
              </Button>
            </div>

            {/* Content Sidebar */}
            <div className="w-full lg:w-[400px] bg-[#0f1115] p-10 flex flex-col h-full border-l border-white/5">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-extrabold tracking-tighter truncate pr-6">{selectedPhoto.name}</h2>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white/20 hover:text-white hover:bg-white/5 rounded-full h-10 w-10 hidden lg:flex"
                  onClick={() => setSelectedPhoto(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <ScrollArea className="flex-1 -mx-2 px-2">
                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      className="rounded-2xl h-14 bg-white text-black hover:bg-white/90 font-bold"
                      onClick={async () => {
                        try {
                          const response = await fetch(selectedPhoto.url);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = selectedPhoto.name;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        } catch (err) {
                          toast.error('ไม่สามารถดาวน์โหลดได้');
                        }
                      }}
                    >
                      <Download className="h-5 w-5 mr-3" />
                      ดาวน์โหลด
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="rounded-2xl h-14 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 font-bold hover:text-white"
                      onClick={() => {
                        handleDelete(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">รายละเอียด</p>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                          <Maximize2 className="h-5 w-5 text-white/40" />
                        </div>
                        <div>
                          <p className="text-white/30 text-xs font-bold uppercase tracking-widest leading-none mb-1.5">ขนาดไฟล์</p>
                          <p className="text-sm font-bold tracking-tight">{formatSize(selectedPhoto.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                          <Calendar className="h-5 w-5 text-white/40" />
                        </div>
                        <div>
                          <p className="text-white/30 text-xs font-bold uppercase tracking-widest leading-none mb-1.5">วันที่อัปโหลด</p>
                          <p className="text-sm font-bold tracking-tight">{formatDate(selectedPhoto.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">แท็กโดย AI</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-9 rounded-xl bg-white/5 text-xs gap-2 px-4 border border-white/5 hover:bg-white/10 text-white font-bold"
                        onClick={() => handleAiTag(selectedPhoto.id)}
                      >
                        <TagIcon className="h-3.5 w-3.5" />
                        วิเคราะห์ใหม่
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPhoto.tags.length > 0 ? (
                        selectedPhoto.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 font-bold text-xs capitalize">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-white/20 italic font-medium">กดปุ่มเพื่อใช้ AI วิเคราะห์แท็ก...</p>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="mt-auto pt-10 text-center">
                <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.3em]">รหัสพื้นที่จัดเก็บ: {selectedPhoto.id.split('-')[0]}</p>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
