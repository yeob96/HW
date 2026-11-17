package com.gongmae.backend.registry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 로컬 디스크 보관. 운영에서는 S3 구현으로 교체한다.
 *
 * <p>해시 앞 두 글자로 디렉터리를 나눠 한 폴더에 파일이 몰리지 않게 한다.
 */
@Component
public class LocalDocumentStorage implements DocumentStorage {

	private final Path root;

	public LocalDocumentStorage(@Value("${app.registry.storage-dir:./data/registry}") String storageDir) {
		this.root = Paths.get(storageDir).toAbsolutePath().normalize();
	}

	@Override
	public String store(String contentHash, String originalFilename, byte[] bytes) throws IOException {
		String extension = extensionOf(originalFilename);
		String key = contentHash.substring(0, 2) + "/" + contentHash + extension;
		Path target = root.resolve(key);
		Files.createDirectories(target.getParent());
		if (!Files.exists(target)) {
			Files.write(target, bytes);
		}
		return key;
	}

	@Override
	public byte[] read(String storageKey) throws IOException {
		return Files.readAllBytes(resolve(storageKey));
	}

	@Override
	public boolean exists(String storageKey) {
		return Files.exists(resolve(storageKey));
	}

	/** 저장 키가 보관 디렉터리 밖을 가리키지 못하게 막는다 */
	private Path resolve(String storageKey) {
		Path path = root.resolve(storageKey).normalize();
		if (!path.startsWith(root)) {
			throw new IllegalArgumentException("보관 디렉터리를 벗어난 경로입니다.");
		}
		return path;
	}

	private static String extensionOf(String filename) {
		if (filename == null) {
			return "";
		}
		int dot = filename.lastIndexOf('.');
		if (dot < 0 || dot == filename.length() - 1) {
			return "";
		}
		String ext = filename.substring(dot).toLowerCase();
		return ext.matches("\\.[a-z0-9]{1,8}") ? ext : "";
	}
}
